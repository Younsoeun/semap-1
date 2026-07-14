// 방문 루트 — 세로 타임라인.
// 추천 순서로 노드를 쌓되, 방문 시작일을 입력한 나라는 날짜 오름차순으로 위에 고정.
// 각 노드에는 방문 날짜 피커와, 그 나라에서 작성한 일지의 사진·기록이 날짜순으로 얹힌다.

import { getRoute, getCountry } from "../data-loader.js";
import * as visits from "../store/visits.js";
import { el, flagImg, fmtDateRange, fmtDate, attachPhoto, openLightbox } from "../ui.js";
import { createDateRange } from "../daterange.js";

export async function renderRoute(container) {
  const route = await getRoute();

  // 노드에 얹을 일지를 위해 등장 국가들의 콘텐츠를 미리 로드
  const keys = new Set();
  for (const stop of route.stops) {
    if (stop.countryKey) keys.add(stop.countryKey);
    for (const c of stop.cities) if (c.countryKey) keys.add(c.countryKey);
  }
  const countries = new Map();
  await Promise.all(
    [...keys].map((k) => getCountry(k).then((c) => countries.set(k, c)).catch(() => {}))
  );

  const page = el("div", { class: "page" }, [
    el("div", { class: "page-head" }, [
      el("h1", { text: "방문 루트" }),
      el("span", { class: "en", text: "ROUTE" }),
    ]),
    el("p", {
      class: "route-intro",
      text: "8월 말~2월 거주 여행 기준 추천 순서입니다. 방문 시작일을 입력하면 그 나라부터 날짜순으로 고정되고, 작성한 일지의 사진과 기록이 타임라인에 함께 쌓입니다.",
    }),
  ]);

  const timeline = el("div", { class: "timeline" });
  page.append(timeline);
  container.append(page);

  function orderedStops() {
    const fixed = [], rest = [];
    for (const stop of route.stops) {
      const d = visits.routeDates(stop.id);
      if (d?.start) fixed.push({ stop, start: d.start });
      else rest.push(stop);
    }
    fixed.sort((a, b) => (a.start < b.start ? -1 : 1));
    return [...fixed.map((f) => f.stop), ...rest];
  }

  function render() {
    timeline.replaceChildren();
    for (const stop of orderedStops()) {
      timeline.append(buildNode(stop, countries, render));
    }
  }
  render();
}

function buildNode(stop, countries, rerender) {
  const d = visits.routeDates(stop.id);
  const isFixed = !!d?.start;

  const node = el("div", { class: `tl-node ${isFixed ? "fixed" : "planned"}` });

  // 날짜 줄
  const when = isFixed
    ? fmtDateRange(d.start, d.end) || fmtDate(d.start)
    : `추천 시기 · ${stop.season}`;
  node.append(
    el("div", { class: "tl-when" }, [
      el("span", { text: when }),
      isFixed ? el("span", { class: "fixed-badge", text: "일정 확정" }) : null,
    ])
  );

  const card = el("div", { class: "tl-card" });
  node.append(card);

  // 헤더: 국기 + 이름(링크, 화살표 없음) + 추천 시즌
  const title = stop.countryKey
    ? el("a", { href: `#/country/${stop.countryKey}`, text: stop.nameKo })
    : el("span", { text: stop.nameKo });
  card.append(
    el("div", { class: "tl-head" }, [
      el("h3", {}, [stop.countryKey ? flagImg(stop.countryKey) : null, title]),
      el("span", { class: "season", text: stop.season }),
    ])
  );
  if (stop.hint) card.append(el("div", { class: "tl-hint", text: stop.hint }));

  // 국가 방문 날짜 피커
  const range = createDateRange({
    start: d?.start || null,
    end: d?.end || null,
    placeholder: "방문 날짜",
    onChange: (s, e) => { visits.setRouteDates(stop.id, s, e); rerender(); },
  });
  card.append(el("div", { class: "tl-dates" }, [el("span", { class: "lbl", text: "방문일" }), range]));

  // 도시별 방문 기록(사진·일지)
  const citiesBox = el("div", { class: "tl-cities" });
  let anyRecord = false;
  for (const city of stop.cities) {
    const cKey = city.countryKey || stop.countryKey;
    const country = cKey ? countries.get(cKey) : null;
    const cityBlock = buildCityRecord(city, cKey, country);
    if (cityBlock) { citiesBox.append(cityBlock); anyRecord = true; }
  }
  if (anyRecord) card.append(citiesBox);

  return node;
}

// 한 도시의 방문 기록: 도시 방문일 + 그 도시 명소들의 일지 사진·노트
function buildCityRecord(city, cKey, country) {
  const cityDate = visits.routeDates(city.id);

  // 이 도시(cityId)에 속한 명소들의 일지 수집
  const shots = [];
  const notes = [];
  if (country && city.cityId) {
    const attractions = country.attractions.filter((a) => a.cityId === city.cityId);
    for (const a of attractions) {
      for (const entry of visits.journalOf(a.id)) {
        for (const pid of entry.photos || []) shots.push({ pid, name: a.nameKo });
        if (entry.text) notes.push({ name: a.nameKo, text: entry.text });
      }
    }
  }

  const hasRecord = shots.length || notes.length || cityDate?.start;
  // 날짜 피커는 항상 제공하되, 기록이 하나도 없고 상세 링크도 없는 도시는 생략
  const cityName =
    city.cityId && cKey
      ? el("a", { href: `#/city/${cKey}/${city.cityId}`, text: city.nameKo })
      : el("span", { text: city.nameKo });

  const block = el("div", { class: "tl-city" });
  const dateRange = createDateRange({
    start: cityDate?.start || null,
    end: cityDate?.end || null,
    placeholder: "날짜",
    onChange: (s, e) => visits.setRouteDates(city.id, s, e),
  });
  block.append(
    el("div", { class: "tl-city-head" }, [
      el("span", { class: "cname" }, [cityName]),
      dateRange,
    ])
  );

  if (shots.length) {
    block.append(
      el(
        "div",
        { class: "tl-shots" },
        shots.slice(0, 8).map(({ pid, name }) => {
          const img = el("img", { alt: name, loading: "lazy" });
          attachPhoto(img, pid);
          img.addEventListener("click", () => img.src && openLightbox(img.src));
          return el("figure", {}, [img, el("figcaption", { text: name })]);
        })
      )
    );
  }
  for (const n of notes.slice(0, 4)) {
    block.append(
      el("div", { class: "tl-note" }, [
        el("span", { class: "place-tag", text: n.name }),
        el("span", { text: n.text.length > 140 ? n.text.slice(0, 140) + "…" : n.text }),
      ])
    );
  }

  return hasRecord || (city.cityId && cKey) ? block : null;
}
