// 도시 상세: 명소 사진 카드 그리드.
// 카드마다 역사/소개/팁, 방문 체크 + 방문 시작·종료일, 마이크로블로그 일지.

import { getCountry, getImages } from "../data-loader.js";
import * as visits from "../store/visits.js";
import { el } from "../ui.js";
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

  // ---- 제목 + 방문 체크 ----
  const check = el("input", { type: "checkbox", class: "visit-check", title: "방문 완료" });
  check.checked = !!visit?.visited;
  check.addEventListener("change", () => {
    visits.setVisited(attraction.id, countryKey, check.checked);
    card.classList.toggle("visited", check.checked);
  });

  body.append(
    el("div", { class: "title-row" }, [el("h3", { text: attraction.nameKo }), check]),
    el("div", { class: "en-name", text: attraction.nameEn })
  );

  // ---- 역사/소개/팁 ----
  body.append(
    el("details", { class: "info" }, [
      el("summary", { text: "역사 · 소개 · 방문 팁" }),
      field("역사", attraction.history),
      field("소개", attraction.intro),
      field("방문 팁", attraction.tip),
    ])
  );

  // ---- 방문일 + 일지 ----
  const visitBlock = el("div", { class: "visit-block" });
  body.append(visitBlock);

  const startInput = el("input", { type: "date", value: visit?.start || "" });
  const endInput = el("input", { type: "date", value: visit?.end || "" });
  const saveDates = () => {
    visits.setVisitDates(attraction.id, countryKey, startInput.value, endInput.value);
  };
  startInput.addEventListener("change", saveDates);
  endInput.addEventListener("change", saveDates);

  visitBlock.append(
    el("div", { class: "visit-row" }, [
      el("span", { text: "방문일" }),
      el("div", { class: "date-inputs" }, [startInput, el("span", { text: "~" }), endInput]),
    ])
  );

  const journalList = el("div", { class: "journal-list" });
  const actions = el("div", { class: "visit-actions" });
  visitBlock.append(journalList, actions);

  let editorOpen = false;

  function renderJournal() {
    journalList.replaceChildren();
    for (const entry of visits.journalOf(attraction.id)) {
      journalList.append(
        buildJournalCard({
          attraction,
          countryKey,
          entry,
          onChanged: renderJournal,
        })
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
            onDone: () => {
              editorOpen = false;
              editor.remove();
              renderJournal();
            },
            onCancel: () => {
              editorOpen = false;
              editor.remove();
              renderActions();
            },
          });
          visitBlock.append(editor);
        },
      })
    );
  }

  renderJournal();
  return card;
}

function field(k, text) {
  if (!text) return null;
  return el("div", { class: "info-field" }, [
    el("div", { class: "k", text: k }),
    el("p", { text }),
  ]);
}
