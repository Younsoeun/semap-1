// 앱 부트스트랩: 테마 → 지구본 → 라우터 → 뷰 디스패치.
// 지구본은 항상 마운트되어 있고(#globe-stage), 홈이 아닌 라우트에서는
// #view가 그 위를 덮는다 — 홈 복귀가 즉각적이도록.

import { initTheme } from "./theme.js";
import { initGlobe } from "./globe.js";
import { startRouter, navigate } from "./router.js";
import { getGeoWorld, getIndex } from "./data-loader.js";
import * as visits from "./store/visits.js";
import { initSync } from "./store/github-sync.js";
import { openCountryPopup } from "./views/country-popup.js";
import { renderCountry } from "./views/country.js";
import { renderCity } from "./views/city.js";
import { renderCulture } from "./views/culture.js";
import { renderRoute } from "./views/route.js";
import { renderJournal } from "./views/journal.js";
import { renderSettings } from "./views/settings.js";

const viewEl = document.getElementById("view");
const stageEl = document.getElementById("globe-stage");
const statsEl = document.getElementById("globe-stats");
const toastEl = document.getElementById("toast");

let toastTimer = null;
export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function renderStats() {
  const t = visits.totals();
  statsEl.innerHTML =
    `방문한 나라 <b class="v">${t.countries}</b> · ` +
    `방문한 명소 <b class="v">${t.attractions}</b> · ` +
    `일지 <b>${t.journalEntries}</b>`;
}

async function main() {
  initTheme(document.getElementById("theme-toggle"));

  // ---- 지구본 ----
  const world = await getGeoWorld();
  const globeCtl = initGlobe({
    el: document.getElementById("globe"),
    tipEl: document.getElementById("globe-tip"),
    features: world.features,
    onCountryClick: (key) => openCountryPopup(key),
  });
  globeCtl.setActive(visits.activeCountries());

  // 호버 팁에 한글 국가명 (팁은 텍스트 pill이라 국기 이미지는 넣지 않음)
  getIndex().then((index) => {
    const labels = {};
    for (const c of index.countries) labels[c.key] = c.nameKo;
    globeCtl.setLabels(labels);
  });

  // ---- 기록 변경 → 지구본·통계 갱신 ----
  renderStats();
  visits.subscribe(() => {
    globeCtl.setActive(visits.activeCountries());
    renderStats();
  });

  // ---- GitHub 동기화 (설정돼 있으면 시작 시 pull, 변경 시 push 큐) ----
  initSync({ toast });

  // ---- 라우팅 ----
  const navLinks = [...document.querySelectorAll(".top-nav a.nav-link")];

  startRouter(async (route) => {
    const isHome = route.name === "home";
    stageEl.style.visibility = isHome ? "visible" : "hidden";
    globeCtl.pauseRendering(!isHome);
    viewEl.hidden = isHome;
    document.getElementById("popup-root").innerHTML = "";

    for (const a of navLinks) {
      const r = a.dataset.route;
      const active =
        r === route.name ||
        (r === "home" && ["country", "city"].includes(route.name)) ||
        (r === "culture" && route.name === "culture");
      a.classList.toggle("active", active);
    }

    if (isHome) {
      viewEl.innerHTML = "";
      return;
    }

    viewEl.innerHTML = "";
    viewEl.scrollTop = 0;
    window.scrollTo(0, 0);
    try {
      switch (route.name) {
        case "country": await renderCountry(viewEl, route.key); break;
        case "city": await renderCity(viewEl, route.key, route.cityId); break;
        case "culture": await renderCulture(viewEl, route.key); break;
        case "route": await renderRoute(viewEl); break;
        case "journal": await renderJournal(viewEl); break;
        case "settings": await renderSettings(viewEl, { toast }); break;
      }
    } catch (err) {
      console.error(err);
      viewEl.innerHTML = `<div class="page"><p class="empty-note">페이지를 불러오지 못했습니다: ${err.message}</p></div>`;
    }
  });
}

main().catch((err) => {
  console.error(err);
  toast(`초기화 실패: ${err.message}`);
});

export { navigate };
