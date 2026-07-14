// 방문 루트 — 추천 순서로 나열하고, 방문 시작일을 입력하면 그 나라들은
// 날짜 오름차순으로 위쪽에 고정된다. 도시별 날짜도 함께 기록.

import { getRoute } from "../data-loader.js";
import * as visits from "../store/visits.js";
import { el } from "../ui.js";

export async function renderRoute(container) {
  const route = await getRoute();

  const page = el("div", { class: "page" }, [
    el("div", { class: "page-head" }, [
      el("h1", { text: "방문 루트" }),
      el("span", { class: "en", text: "ROUTE" }),
    ]),
    el("p", {
      style: "color:var(--muted)",
      text: "8월 말~2월 거주 여행 기준 추천 순서입니다. 방문 시작일을 입력하면 일정이 확정된 나라부터 날짜순으로 고정됩니다.",
    }),
  ]);

  const list = el("div", { class: "route-list" });
  page.append(list);
  container.append(page);

  function orderedStops() {
    const fixed = [];
    const rest = [];
    for (const stop of route.stops) {
      const d = visits.routeDates(stop.id);
      if (d?.start) fixed.push({ stop, start: d.start });
      else rest.push(stop);
    }
    fixed.sort((a, b) => (a.start < b.start ? -1 : 1));
    return [...fixed.map((f) => f.stop), ...rest];
  }

  function render() {
    list.replaceChildren();
    for (const stop of orderedStops()) {
      list.append(buildStop(stop, render));
    }
  }

  render();
}

function dateInputs(id, onSaved) {
  const d = visits.routeDates(id);
  const start = el("input", { type: "date", value: d?.start || "" });
  const end = el("input", { type: "date", value: d?.end || "" });
  const save = () => {
    visits.setRouteDates(id, start.value, end.value);
    onSaved?.();
  };
  start.addEventListener("change", save);
  end.addEventListener("change", save);
  return [start, end];
}

function buildStop(stop, rerender) {
  const d = visits.routeDates(stop.id);
  const isFixed = !!d?.start;

  const [startInput, endInput] = dateInputs(stop.id, rerender);

  const nameEl = stop.countryKey
    ? el("a", { href: `#/country/${stop.countryKey}`, text: `${stop.nameKo} ↗` })
    : el("span", { text: stop.nameKo });

  const cityRows = el(
    "div",
    { class: "route-city-rows" },
    stop.cities.map((city) => {
      const cKey = city.countryKey || stop.countryKey;
      const cityName =
        city.cityId && cKey
          ? el("a", { href: `#/city/${cKey}/${city.cityId}`, text: `${city.nameKo} ↗` })
          : el("span", { text: city.nameKo });
      const [cs, ce] = dateInputs(city.id, null);
      return el("div", { class: "route-city-row" }, [
        el("span", { class: "city-name" }, [cityName]),
        cs,
        el("span", { text: "~" }),
        ce,
      ]);
    })
  );

  return el("div", { class: `route-stop${isFixed ? " fixed" : ""}` }, [
    el("div", { class: "stop-head" }, [
      el("span", { class: "flag", text: stop.flag || "" }),
      el("h3", {}, [nameEl]),
      el("span", { class: "season", text: `추천 ${stop.season}` }),
      isFixed ? el("span", { class: "badge", text: "일정 확정" }) : null,
    ]),
    stop.hint ? el("p", { class: "hint", text: stop.hint }) : null,
    el("div", { class: "stop-dates" }, [
      el("span", { text: "방문 시작일" }),
      startInput,
      el("span", { text: "종료일" }),
      endInput,
    ]),
    cityRows,
  ]);
}
