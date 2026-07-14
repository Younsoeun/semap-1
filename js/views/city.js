// 도시 상세: 명소 사진 카드 그리드.
// 카드마다 역사/소개/팁(+박물관은 대표 작품), 방문 토글 + 방문 날짜 범위, 일지.

import { getCountry, getImages } from "../data-loader.js";
import * as visits from "../store/visits.js";
import { el } from "../ui.js";
import { createDateRange } from "../daterange.js";
import { buildJournalCard, buildJournalEditor } from "./journal-ui.js";

export async function renderCity(container, key, cityId) {
  const [country, images] = await Promise.all([getCountry(key), getImages()]);
  const city = country.cities.find((c) => c.id === cityId);
  if (!city) throw new Error("도시를 찾을 수 없습니다");

  const attractions = country.attractions.filter((a) => a.cityId === cityId);
  const catColor = new Map(country.categories.map((c, i) => [c.id, c.varName || `--c${i + 1}`]));
  const catName = new Map(country.categories.map((c) => [c.id, c.nameKo]));

  let visited = 0;
  for (const a of attractions) if (visits.getVisit(a.id)?.visited) visited += 1;

  const page = el("div", { class: "page" }, [
    el("a", { class: "back-link", href: `#/country/${key}`, text: `← ${country.nameKo} 지도로` }),
    el("div", { class: "page-head" }, [
      el("h1", { text: city.nameKo }),
      el("span", { class: "en", text: city.nameEn.toUpperCase() }),
    ]),
    el("div", { class: "stat-line" }, [
      el("span", { html: `명소 <b>${attractions.length}</b>` }),
      el("span", { html: `방문 <b class="v">${visited}</b>/${attractions.length}` }),
    ]),
  ]);

  const grid = el("div", { class: "attraction-grid" });
  for (const a of attractions) {
    grid.append(buildAttractionCard(a, key, images, catColor, catName));
  }
  page.append(grid);
  container.append(page);
}

function buildAttractionCard(attraction, countryKey, images, catColor, catName) {
  const visit = visits.getVisit(attraction.id);
  const card = el("div", {
    class: `attraction-card${visit?.visited ? " visited" : ""}`,
    id: `attraction-${attraction.id}`,
  });

  // ---- 커버 사진 + 카테고리 태그 ----
  const img = images[attraction.id];
  card.append(
    el("div", { class: "cover" }, [
      img ? el("img", { src: img, alt: attraction.nameKo, loading: "lazy" }) : null,
      el("span", { class: "tag", style: `--tag-color: var(${catColor.get(attraction.category) || "--c1"})` }, [
        el("span", { class: "dot" }),
        el("span", { text: catName.get(attraction.category) || attraction.category }),
      ]),
    ])
  );

  const body = el("div", { class: "body" });
  card.append(body);

  body.append(
    el("div", { class: "title-row" }, [el("h3", { text: attraction.nameKo })]),
    el("div", { class: "en-name", text: attraction.nameEn })
  );

  // ---- 역사/소개/팁 (+ 대표 작품) ----
  const info = el("details", { class: "info" }, [
    el("summary", { text: "역사 · 소개 · 방문 팁" }),
    field("역사", attraction.history),
    field("소개", attraction.intro),
    field("방문 팁", attraction.tip),
  ]);
  if (attraction.highlights?.length) info.append(buildArtworks(attraction.highlights));
  body.append(info);

  // ---- 방문 토글 + 방문일 + 일지 ----
  const visitBlock = el("div", { class: "visit-block" });
  body.append(visitBlock);

  // 방문 토글: 라벨이 있어 역할이 분명하고, 지구본 활성화·통계에 실제로 반영됨
  const toggle = el("button", { class: "btn toggle" });
  function renderToggle() {
    const on = !!visits.getVisit(attraction.id)?.visited;
    toggle.classList.toggle("on", on);
    toggle.textContent = on ? "✓ 방문함" : "방문 표시";
  }
  toggle.addEventListener("click", () => {
    const on = !visits.getVisit(attraction.id)?.visited;
    visits.setVisited(attraction.id, countryKey, on);
    card.classList.toggle("visited", on);
    renderToggle();
  });
  renderToggle();

  const dateRange = createDateRange({
    start: visit?.start || null,
    end: visit?.end || null,
    placeholder: "방문 날짜",
    onChange: (s, e) => visits.setVisitDates(attraction.id, countryKey, s, e),
  });

  visitBlock.append(
    el("div", { class: "visit-row" }, [toggle, el("span", { class: "lbl", text: "방문일" }), dateRange])
  );

  const journalList = el("div", { class: "journal-list" });
  const actions = el("div", { class: "visit-actions" });
  visitBlock.append(journalList, actions);

  let editorOpen = false;

  function renderJournal() {
    journalList.replaceChildren();
    for (const entry of visits.journalOf(attraction.id)) {
      journalList.append(
        buildJournalCard({ attraction, countryKey, entry, onChanged: renderJournal })
      );
    }
    renderActions();
  }

  function renderActions() {
    actions.replaceChildren();
    if (editorOpen) return;
    const has = visits.hasJournal(attraction.id);
    actions.append(
      el("button", {
        class: `btn ${has ? "visited-state" : "primary"}`,
        text: has ? "일지 더 쓰기" : "방문 일지 작성하기",
        onclick: () => {
          editorOpen = true;
          renderActions();
          const editor = buildJournalEditor({
            attraction,
            countryKey,
            onDone: () => { editorOpen = false; editor.remove(); renderJournal(); },
            onCancel: () => { editorOpen = false; editor.remove(); renderActions(); },
          });
          visitBlock.append(editor);
        },
      })
    );
  }

  renderJournal();
  return card;
}

function buildArtworks(highlights) {
  return el("div", { class: "artworks" }, [
    el("div", { class: "k", text: "대표 작품 · 볼거리" }),
    ...highlights.map((h) =>
      el("div", { class: "artwork" }, [
        el("div", {}, [
          el("span", { class: "aw-name", text: h.name }),
          h.artist ? el("span", { class: "aw-artist", text: h.artist }) : null,
        ]),
        h.desc ? el("p", { class: "aw-desc", text: h.desc }) : null,
      ])
    ),
  ]);
}

function field(k, text) {
  if (!text) return null;
  return el("div", { class: "info-field" }, [
    el("div", { class: "k", text: k }),
    el("p", { text }),
  ]);
}
