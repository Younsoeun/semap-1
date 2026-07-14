// 일지 모아보기 — 모든 명소의 일지를 최신순 갤러리로.
// 두 축으로 필터: 국가 / 명소 분류(카테고리). 두 필터는 AND로 결합.

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

  const countryKeys = [...new Set(all.map((j) => j.entry.country).filter(Boolean))];
  const countries = new Map();
  await Promise.all(
    countryKeys.map((k) => getCountry(k).then((c) => countries.set(k, c)).catch(() => {}))
  );

  // attractionId → { attraction, countryKey, cityId, categoryKo }
  const attractionInfo = new Map();
  const categoryLabels = new Set();
  for (const [k, c] of countries) {
    const catName = new Map(c.categories.map((cat) => [cat.id, cat.nameKo]));
    for (const a of c.attractions) {
      const categoryKo = catName.get(a.category) || a.category;
      attractionInfo.set(a.id, { attraction: a, countryKey: k, cityId: a.cityId, categoryKo });
    }
  }
  // 실제 일지가 있는 명소들의 분류만 필터 후보로
  for (const { attractionId } of all) {
    const info = attractionInfo.get(attractionId);
    if (info) categoryLabels.add(info.categoryKo);
  }

  let countryFilter = null;
  let categoryFilter = null;

  const countryTabs = el("div", { class: "culture-tabs" });
  const categoryTabs = el("div", { class: "culture-tabs" });
  const list = el("div", { class: "journal-list" });

  function pill(label, active, onClick) {
    return el("button", { class: `filter-pill${active ? " active" : ""}`, text: label, onclick: onClick });
  }

  function renderTabs() {
    countryTabs.replaceChildren(
      pill(`전체 나라`, countryFilter === null, () => { countryFilter = null; renderTabs(); renderList(); }),
      ...countryKeys.map((k) =>
        pill(nameByKey.get(k) || k, countryFilter === k, () => { countryFilter = k; renderTabs(); renderList(); })
      )
    );
    categoryTabs.replaceChildren(
      pill(`전체 분류`, categoryFilter === null, () => { categoryFilter = null; renderTabs(); renderList(); }),
      ...[...categoryLabels].map((c) =>
        pill(c, categoryFilter === c, () => { categoryFilter = c; renderTabs(); renderList(); })
      )
    );
  }

  function renderList() {
    list.replaceChildren();
    const entries = visits.allJournalEntries().filter((j) => {
      if (countryFilter && j.entry.country !== countryFilter) return false;
      if (categoryFilter) {
        const info = attractionInfo.get(j.attractionId);
        if (!info || info.categoryKo !== categoryFilter) return false;
      }
      return true;
    });
    if (!entries.length) {
      list.append(el("p", { class: "empty-note", text: "조건에 맞는 일지가 없습니다." }));
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
  page.append(
    el("div", { class: "journal-filters" }, [
      el("div", { class: "filter-label", text: "국가" }),
      countryTabs,
      el("div", { class: "filter-label", text: "분류" }),
      categoryTabs,
    ]),
    list
  );
}
