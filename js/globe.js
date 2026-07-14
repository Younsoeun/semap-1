// 메인 3D 지구본 (globe.gl / three.js).
// - 콘텐츠가 있는 국가(feature.properties.key 보유)만 인터랙티브
// - 호버: 폴리곤이 밝아지고 이름 팁 표시
// - 클릭: 국가 요약 팝업 열기 (app.js 콜백)
// - 방문 활성화 국가는 오로라 틸로 채움
// - 첫 조작 전까지 천천히 자동 회전, 기본 시점은 유럽

import { currentTheme, onThemeChange } from "./theme.js";

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function initGlobe({ el, tipEl, features, onCountryClick }) {
  const globe = Globe()(el);
  let hoverFeature = null;
  let activeSet = new Set();

  const colors = {};
  function readColors() {
    colors.sea = cssVar("--globe-sea");
    colors.land = cssVar("--globe-land");
    colors.landLine = cssVar("--globe-land-line");
    colors.active = cssVar("--globe-active");
    colors.activeLine = cssVar("--globe-active-line");
    colors.hover = cssVar("--globe-hover");
    colors.visited = cssVar("--globe-visited");
    colors.atmosphere = cssVar("--point");
  }
  readColors();

  const isKeyed = (d) => !!d.properties.key;
  const isActive = (d) => isKeyed(d) && activeSet.has(d.properties.key);

  function capColor(d) {
    if (d === hoverFeature) return colors.hover;
    if (isActive(d)) return colors.visited;
    if (isKeyed(d)) return colors.active;
    return colors.land;
  }

  function strokeColor(d) {
    if (isActive(d)) return colors.visited;
    if (isKeyed(d)) return colors.activeLine;
    return colors.landLine;
  }

  globe
    .backgroundColor("rgba(0,0,0,0)")
    .showAtmosphere(true)
    .atmosphereColor(colors.atmosphere)
    .atmosphereAltitude(0.16)
    .polygonsData(features)
    .polygonCapColor(capColor)
    .polygonSideColor(() => "rgba(0,0,0,0.12)")
    .polygonStrokeColor(strokeColor)
    .polygonAltitude((d) => (d === hoverFeature ? 0.022 : 0.007))
    .polygonsTransitionDuration(180)
    .onPolygonHover((feat) => {
      hoverFeature = feat && isKeyed(feat) ? feat : null;
      el.style.cursor = hoverFeature ? "pointer" : "grab";
      globe.polygonCapColor(capColor).polygonAltitude((d) => (d === hoverFeature ? 0.022 : 0.007));
      updateTip();
    })
    .onPolygonClick((feat) => {
      if (feat && isKeyed(feat)) onCountryClick(feat.properties.key);
    });

  globe.globeMaterial().color.set(colors.sea);

  // ---- 호버 팁 (커서 따라다니는 이름 라벨) ----
  let pointer = { x: 0, y: 0 };
  el.addEventListener("pointermove", (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    updateTip();
  });

  function updateTip() {
    if (!hoverFeature) {
      tipEl.hidden = true;
      return;
    }
    tipEl.hidden = false;
    tipEl.textContent = tipLabel(hoverFeature.properties.key) || hoverFeature.properties.name;
    tipEl.style.left = `${pointer.x + 14}px`;
    tipEl.style.top = `${pointer.y + 16}px`;
  }

  // 국가명 한글 라벨은 app.js가 인덱스 로드 후 주입
  let labelByKey = {};
  function tipLabel(key) {
    return labelByKey[key];
  }

  // ---- 카메라: 유럽 포커스 + 첫 조작 전 자동 회전 ----
  globe.pointOfView({ lat: 47, lng: 10, altitude: 1.7 }, 0);
  const controls = globe.controls();
  controls.autoRotate = false; // 자동 회전 비활성화 (사용자 요청)
  controls.minDistance = 130;
  controls.maxDistance = 420;

  // ---- 크기 추적 ----
  const resize = () => {
    globe.width(el.clientWidth).height(el.clientHeight);
  };
  new ResizeObserver(resize).observe(el);
  resize();

  // ---- 테마 전환 시 색 갱신 ----
  onThemeChange(() => {
    // CSS 변수 적용 이후 값을 읽어야 하므로 다음 프레임에
    requestAnimationFrame(() => {
      readColors();
      globe.globeMaterial().color.set(colors.sea);
      globe
        .atmosphereColor(colors.atmosphere)
        .polygonCapColor(capColor)
        .polygonStrokeColor(strokeColor);
    });
  });

  return {
    setActive(set) {
      activeSet = set;
      globe.polygonCapColor(capColor).polygonStrokeColor(strokeColor);
    },
    setLabels(map) {
      labelByKey = map;
    },
    focusEurope(ms = 800) {
      globe.pointOfView({ lat: 47, lng: 10, altitude: 1.7 }, ms);
    },
    pauseRendering(paused) {
      globe.pauseAnimation && (paused ? globe.pauseAnimation() : globe.resumeAnimation());
    },
  };
}
