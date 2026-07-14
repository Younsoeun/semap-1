// 문화 페이지 — 국가 단위. 목록(카드 그리드) → 국가별 6개 섹션 + 인사 키트 탭.

import { getCulture, getGreetings, getProfiles } from "../data-loader.js";
import { el, flagImg } from "../ui.js";

export async function renderCulture(container, key) {
  const [culture, greetings, profiles] = await Promise.all([
    getCulture(),
    getGreetings().catch(() => null),
    getProfiles().catch(() => ({})),
  ]);

  if (!key) return renderList(container, culture, profiles);

  const country = culture.countries.find((c) => c.key === key);
  if (!country) return renderList(container, culture, profiles);

  const page = el("div", { class: "page" }, [
    el("a", { class: "back-link", href: "#/culture", text: "← 문화 목록으로" }),
    el("div", { class: "page-head" }, [
      el("h1", {}, [flagImg(key), el("span", { text: ` ${country.nameKo} 문화` })]),
      el("span", { class: "en", text: country.nameEn.toUpperCase() }),
    ]),
    country.tagline ? el("p", { style: "color:var(--muted)", text: country.tagline }) : null,
  ]);

  // ---- 탭: 문화 섹션들 + 인사 키트 ----
  const kit = greetings?.countries?.[key];
  const tabs = el("div", { class: "culture-tabs" });
  const bodyEl = el("div");
  let active = "culture";

  function renderTabs() {
    tabs.replaceChildren(
      el("button", {
        class: `filter-pill${active === "culture" ? " active" : ""}`,
        text: "문화·팁",
        onclick: () => {
          active = "culture";
          renderTabs();
          renderBody();
        },
      }),
      kit
        ? el("button", {
            class: `filter-pill${active === "greet" ? " active" : ""}`,
            text: "인사 키트",
            onclick: () => {
              active = "greet";
              renderTabs();
              renderBody();
            },
          })
        : null
    );
  }

  function renderBody() {
    bodyEl.replaceChildren();
    if (active === "culture") {
      for (const section of country.sections) {
        bodyEl.append(
          el("div", { class: "culture-section panel panel-pad" }, [
            el("h3", { text: section.titleKo }),
            ...section.paragraphs.map((p) => el("p", { text: p })),
          ])
        );
      }
    } else if (kit) {
      const table = el("table", { class: "greet-table" }, [
        el("thead", {}, [
          el("tr", {}, [
            el("th", { text: "우리말" }),
            el("th", { text: kit.lang }),
            el("th", { text: "발음" }),
          ]),
        ]),
        el(
          "tbody",
          {},
          greetings.phrases.map((phrase) => {
            const item = kit.items[phrase.id];
            if (!item) return null;
            return el("tr", {}, [
              el("td", { text: phrase.ko }),
              el("td", { class: "native", text: item.native }),
              el("td", { class: "roman", text: item.roman }),
            ]);
          })
        ),
      ]);
      bodyEl.append(
        el("div", { class: "culture-section panel panel-pad" }, [
          el("h3", { text: `여행 인사 키트 — ${kit.lang}` }),
          kit.note ? el("p", { style: "color:var(--muted);font-size:0.88rem", text: kit.note }) : null,
          table,
        ])
      );
    }
  }

  renderTabs();
  renderBody();
  page.append(tabs, bodyEl);
  container.append(page);
}

function renderList(container, culture, profiles) {
  const page = el("div", { class: "page" }, [
    el("div", { class: "page-head" }, [
      el("h1", { text: "국가별 문화" }),
      el("span", { class: "en", text: "CULTURE" }),
    ]),
    el("p", {
      style: "color:var(--muted)",
      text: "여행 전에 알아두면 그 나라를 100% 즐길 수 있는 것들 — 인사, 음식, 매너, 축제.",
    }),
  ]);

  const grid = el("div", { class: "culture-country-grid" });
  for (const c of culture.countries) {
    grid.append(
      el("a", { class: "culture-country-card", href: `#/culture/${c.key}` }, [
        el("div", { class: "flag" }, [flagImg(c.key, "lg")]),
        el("div", { class: "name", text: c.nameKo }),
        el("div", { class: "tagline", text: c.tagline || "" }),
      ])
    );
  }
  page.append(grid);
  container.append(page);
}
