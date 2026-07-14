// 국가 요약 팝업 — 지구본에서 국가 클릭 시 뜨는 "게임 프로필" 카드.

import { getCountry, getProfiles, getGreetings } from "../data-loader.js";
import * as visits from "../store/visits.js";
import { el, fmtDateRange } from "../ui.js";

export async function openCountryPopup(key) {
  const root = document.getElementById("popup-root");
  root.innerHTML = "";

  const [country, profiles, greetings] = await Promise.all([
    getCountry(key),
    getProfiles().catch(() => ({})),
    getGreetings().catch(() => null),
  ]);
  const profile = profiles[key] || {};

  const attractionIds = country.attractions.map((a) => a.id);
  const stats = visits.countryStats(key, attractionIds);
  const isActive = visits.activeCountries().has(key);

  const close = () => root.replaceChildren();

  const statItems = [
    ["수도", profile.capital],
    ["언어", profile.language],
    ["통화", profile.currency],
    ["시차", profile.tz],
    ["인구", profile.population],
    ["여행 최적기", profile.bestSeason],
  ].filter(([, v]) => v);

  // 인사말 미리보기: 인사·감사 두 개
  const kit = greetings?.countries?.[key];
  const previews = [];
  if (kit) {
    for (const pid of ["hello", "thanks"]) {
      const phrase = greetings.phrases.find((p) => p.id === pid);
      const item = kit.items[pid];
      if (phrase && item) previews.push({ ko: phrase.ko, ...item });
    }
  }

  // 방문한 날짜 범위(체크된 명소들의 날짜에서 최솟값~최댓값)
  let visitedRange = "";
  if (isActive) {
    let min = null, max = null;
    for (const id of attractionIds) {
      const v = visits.getVisit(id);
      if (!v?.visited) continue;
      for (const d of [v.start, v.end]) {
        if (!d) continue;
        if (!min || d < min) min = d;
        if (!max || d > max) max = d;
      }
    }
    visitedRange = fmtDateRange(min, max);
  }

  const card = el("div", { class: `sheet panel profile-card${isActive ? " is-visited" : ""}` }, [
    el("div", { class: "profile-head" }, [
      el("div", { class: "profile-flag", text: profile.flag || "🌍" }),
      el("div", { class: "profile-name" }, [
        el("h2", { text: country.nameKo }),
        el("div", { class: "en", text: country.nameEn }),
      ]),
      el("button", {
        class: "icon-btn profile-close",
        "aria-label": "닫기",
        text: "✕",
        onclick: close,
      }),
    ]),
    profile.tagline ? el("p", { class: "profile-tagline", text: profile.tagline }) : null,
    el(
      "div",
      { class: "profile-stats" },
      statItems.map(([k, v]) =>
        el("div", { class: "stat" }, [
          el("div", { class: "k", text: k }),
          el("div", { class: "value", text: v }),
        ])
      )
    ),
    previews.length
      ? el("div", { class: "profile-greet" }, [
          el("div", { class: "k", text: `인사 키트 — ${kit.lang}` }),
          ...previews.map((p) =>
            el("div", {}, [
              el("span", { class: "native", text: p.native }),
              el("span", { text: ` ${p.roman} · ${p.ko}` }),
            ])
          ),
        ])
      : null,
    el("div", { class: "profile-progress" }, [
      el("span", {
        html: `명소 <b>${country.attractions.length}</b>곳 · 도시 <b>${country.cities.length}</b>곳 · 방문 <b class="v">${stats.visited}</b>/${stats.total}`,
      }),
      visitedRange ? el("span", { text: ` · ${visitedRange}` }) : null,
    ]),
    el("div", { class: "profile-actions" }, [
      el("a", {
        class: "btn primary",
        href: `#/country/${key}`,
        text: "상세 지도 열기",
        onclick: close,
      }),
      el("a", {
        class: "btn",
        href: `#/culture/${key}`,
        text: "문화 알아보기",
        onclick: close,
      }),
    ]),
  ]);

  const overlay = el("div", {
    class: "overlay",
    onclick: (e) => {
      if (e.target === overlay) close();
    },
  }, [card]);

  root.append(overlay);
}
