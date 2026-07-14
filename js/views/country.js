// 국가 상세: 실제 admin-1 경계 SVG 지도(도시 마커 + 그리디 라벨) + 도시 카드 그리드.

import { getCountry, getGeoCountry, getImages } from "../data-loader.js";
import * as visits from "../store/visits.js";
import { el, escapeHtml } from "../ui.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export async function renderCountry(container, key) {
  const [country, geo, images] = await Promise.all([
    getCountry(key),
    getGeoCountry(key).catch(() => null),
    getImages(),
  ]);

  const attractionIds = country.attractions.map((a) => a.id);
  const stats = visits.countryStats(key, attractionIds);

  const page = el("div", { class: "page" }, [
    el("a", { class: "back-link", href: "#/", text: "← 지구본으로" }),
    el("div", { class: "page-head" }, [
      el("h1", { text: country.nameKo }),
      el("span", { class: "en", text: country.nameEn.toUpperCase() }),
    ]),
    el("div", { class: "stat-line" }, [
      el("span", { html: `도시 <b>${country.cities.length}</b>` }),
      el("span", { html: `명소 <b>${country.attractions.length}</b>` }),
      el("span", {
        html: `방문 <b class="v">${stats.visited}</b>/${stats.total} (${
          stats.total ? Math.round((stats.visited / stats.total) * 100) : 0
        }%)`,
      }),
    ]),
  ]);

  if (geo) page.append(buildMap(geo, country, key));

  page.append(el("h2", { class: "section-title", text: "도시" }));
  page.append(buildCityGrid(country, key, images));

  container.append(page);
}

// ---- SVG 지도 ----

function project(geo, lon, lat) {
  const p = geo.projection;
  const cos = Math.cos((p.centerLat * Math.PI) / 180);
  return [lon * cos * p.scale + p.offsetX, -lat * p.scale + p.offsetY];
}

function cityVisitState(country, cityId) {
  const ids = country.attractions.filter((a) => a.cityId === cityId).map((a) => a.id);
  if (!ids.length) return "none";
  let n = 0;
  for (const id of ids) if (visits.getVisit(id)?.visited) n += 1;
  return n === 0 ? "none" : n === ids.length ? "all" : "some";
}

function buildMap(geo, country, key) {
  const wrap = el("div", { class: "country-map-wrap panel panel-pad" });
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", geo.viewBox);

  // 국가 채움(밑바탕) → 행정구역 경계.
  // 국경 외곽선(50m)은 행정구역(10m)과 미세하게 어긋나 이중선처럼 보이므로
  // 그리지 않는다. 행정구역이 없는 나라(noDistricts)만 외곽선을 채움 경계로 쓴다.
  const base = document.createElementNS(SVG_NS, "path");
  base.setAttribute("d", geo.outline);
  base.setAttribute("class", geo.districts.length ? "map-outline-fill" : "map-district");
  svg.append(base);

  for (const d of geo.districts) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d.path);
    path.setAttribute("class", "map-district");
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = d.name;
    path.append(title);
    svg.append(path);
  }

  // 도시 마커(점 + 얇은 링) + 그리디 라벨 배치(우/좌/하/상 중 안 겹치는 곳)
  const [, , vbW, vbH] = geo.viewBox.split(" ").map(Number);
  const placedRects = [];

  const labelRect = (x, y, w, h) => ({ x, y: y - h + 3, w, h });
  const overlaps = (r) =>
    placedRects.some(
      (p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y
    ) ||
    r.x < 0 || r.y < 0 || r.x + r.w > vbW || r.y + r.h > vbH;

  for (const city of country.cities) {
    const [x, y] = project(geo, city.lon, city.lat);
    const state = cityVisitState(country, city.id);

    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", `city-marker${state === "all" ? " visited" : ""}`);

    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", x);
    ring.setAttribute("cy", y);
    ring.setAttribute("r", 8);
    ring.setAttribute("class", "ring");

    const core = document.createElementNS(SVG_NS, "circle");
    core.setAttribute("cx", x);
    core.setAttribute("cy", y);
    core.setAttribute("r", 3.4);
    core.setAttribute("class", "core");
    if (state === "some") core.style.fill = "var(--visited)";

    g.append(ring, core);

    const textW = city.nameKo.length * 13.5 + 6;
    const textH = 15;
    const candidates = [
      [x + 13, y + 4],                    // 우
      [x - 13 - textW, y + 4],            // 좌
      [x - textW / 2, y + 22],            // 하
      [x - textW / 2, y - 14],            // 상
    ];
    let pos = candidates[0];
    for (const c of candidates) {
      if (!overlaps(labelRect(c[0], c[1], textW, textH))) {
        pos = c;
        break;
      }
    }
    placedRects.push(labelRect(pos[0], pos[1], textW, textH));

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", pos[0]);
    label.setAttribute("y", pos[1]);
    label.setAttribute("class", "city-label");
    label.textContent = city.nameKo;

    const go = () => (location.hash = `#/city/${key}/${city.id}`);
    g.addEventListener("click", go);
    label.addEventListener("click", go);

    svg.append(g, label);
  }

  wrap.append(svg);
  return wrap;
}

// ---- 도시 카드 그리드 ----

function cityImage(country, cityId, images) {
  for (const a of country.attractions) {
    if (a.cityId === cityId && images[a.id]) return images[a.id];
  }
  return null;
}

function buildCityGrid(country, key, images) {
  const grid = el("div", { class: "city-grid" });
  for (const city of country.cities) {
    const attractions = country.attractions.filter((a) => a.cityId === city.id);
    let visited = 0;
    for (const a of attractions) if (visits.getVisit(a.id)?.visited) visited += 1;
    const img = cityImage(country, city.id, images);

    grid.append(
      el("a", { class: "city-card", href: `#/city/${key}/${city.id}` }, [
        img ? el("img", { src: img, alt: city.nameKo, loading: "lazy" }) : null,
        el("div", { class: "shade" }),
        el("div", { class: "meta" }, [
          el("div", { class: "name", text: city.nameKo }),
          el("div", {
            class: "sub",
            html: `명소 ${attractions.length}곳${
              visited ? ` · <span class="v">방문 ${visited}</span>` : ""
            } · ${escapeHtml(city.nameEn)}`,
          }),
        ]),
      ])
    );
  }
  return grid;
}
