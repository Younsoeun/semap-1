// 일지 모아보기 — 모든 명소의 일지를 최신순 갤러리로, 국가별 필터.

import { getCountry, getIndex } from "../data-loader.js";
import * as visits from "../store/visits.js";
import { el } from "../ui.js";
import { buildJournalCard } from "./journal-ui.js";

export async function renderJournal(container) {
  const all = visits.allJournalEntries();
  const index = await getIndex();
  const nameByKey = new Map(index.countries.map((c) => [c.key, c.nameKo]));

  const page = el("div", { class: "page" }, [
    el("div", { class: "page-head" }, [
      el("h1", { text: "방문 일지" }),
      el("span", { class: "en", text: "JOURNAL" }),
    ]),
  ]);
  container.append(page);

  if (!all.length) {
    page.append(
      el("p", {
        class: "empty-note",
        text: "아직 작성한 일지가 없습니다. 지구본에서 국가를 골라 명소에 첫 일지를 남겨보세요.",
      })
    );
    return;
  }

  // 등장하는 국가들의 콘텐츠를 로드해 명소 이름/도시 링크를 얻는다
  const countryKeys = [...new Set(all.map((j) => j.entry.country).filter(Boolean))];
  const countries = new Map();
  await Promise.all(
    countryKeys.map((k) =>
      getCountry(k)
        .then((c) => countries.set(k, c))
        .catch(() => {})
    )
  );

  const attractionInfo = new Map(); // id → { attraction, countryKey, cityId }
  for (const [k, c] of countries) {
    for (const a of c.attractions) {
      attractionInfo.set(a.id, { attraction: a, countryKey: k, cityId: a.cityId });
    }
  }

  // ---- 국가 필터 ----
  let filter = null;
  const tabs = el("div", { class: "culture-tabs" });
  const list = el("div", { class: "journal-list" });

  function renderTabs() {
    tabs.replaceChildren(
      el("button", {
        class: `filter-pill${filter === null ? " active" : ""}`,
        text: `전체 ${all.length}`,
        onclick: () => {
          filter = null;
          renderTabs();
          renderList();
        },
      }),
      ...countryKeys.map((k) =>
        el("button", {
          class: `filter-pill${filter === k ? " active" : ""}`,
          text: nameByKey.get(k) || k,
          onclick: () => {
            filter = k;
            renderTabs();
            renderList();
          },
        })
      )
    );
  }

  function renderList() {
    list.replaceChildren();
    const entries = visits
      .allJournalEntries()
      .filter((j) => !filter || j.entry.country === filter);
    if (!entries.length) {
      list.append(el("p", { class: "empty-note", text: "이 국가의 일지가 없습니다." }));
      return;
    }
    for (const { attractionId, entry } of entries) {
      const info = attractionInfo.get(attractionId);
      if (!info) continue;
      list.append(
        buildJournalCard({
          attraction: info.attraction,
          countryKey: info.countryKey,
          entry,
          placeLink: `#/city/${info.countryKey}/${info.cityId}`,
          onChanged: renderList,
        })
      );
    }
  }

  renderTabs();
  renderList();
  page.append(tabs, list);
}
