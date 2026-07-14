// 날짜 범위 피커 — 네이티브 date input 대신 쓰는 커스텀 캘린더.
// (originui date-range-picker 스타일: 트리거 버튼 → 팝오버 달력, 범위 선택)
//
// createDateRange({ start, end, onChange, placeholder }) → 트리거 엘리먼트.
//   start/end: "YYYY-MM-DD" | null,  onChange(startISO|null, endISO|null)

import { el } from "./ui.js";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parse(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}
function fmt(s) {
  const p = parse(s);
  return p ? `${p.m + 1}월 ${p.d}일` : "";
}

export function createDateRange({ start = null, end = null, onChange, placeholder = "날짜 선택" }) {
  let selStart = start;
  let selEnd = end;

  const label = el("span", { class: "dr-label" });
  const trigger = el("button", { class: "dr-trigger", type: "button" }, [
    el("span", { class: "dr-cal-ico", text: "📅" }),
    label,
  ]);
  const root = el("span", { class: "dr-root" }, [trigger]);

  function renderLabel() {
    if (selStart && selEnd) label.textContent = `${fmt(selStart)} ~ ${fmt(selEnd)}`;
    else if (selStart) label.textContent = `${fmt(selStart)} ~ …`;
    else {
      label.textContent = placeholder;
      label.classList.add("empty");
      return;
    }
    label.classList.remove("empty");
  }
  renderLabel();

  let pop = null;
  let viewYear, viewMonth;

  function openPop() {
    if (pop) return closePop();
    const base = parse(selStart) || parse(selEnd) || currentYM();
    viewYear = base.y;
    viewMonth = base.m;
    pop = el("div", { class: "dr-pop" });
    root.append(pop);
    drawCal();
    setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  }
  function closePop() {
    if (!pop) return;
    document.removeEventListener("pointerdown", outside, true);
    pop.remove();
    pop = null;
  }
  function outside(e) {
    if (!root.contains(e.target)) closePop();
  }
  function currentYM() {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  }

  function commit() {
    renderLabel();
    onChange?.(selStart, selEnd);
  }

  function pick(dayIso) {
    if (!selStart || (selStart && selEnd)) {
      selStart = dayIso;
      selEnd = null;
    } else if (dayIso < selStart) {
      selEnd = selStart;
      selStart = dayIso;
    } else {
      selEnd = dayIso;
    }
    commit();
    drawCal();
    if (selStart && selEnd) setTimeout(closePop, 180);
  }

  function drawCal() {
    pop.replaceChildren();

    const head = el("div", { class: "dr-head" }, [
      el("button", { class: "dr-nav", type: "button", text: "‹", onclick: () => shift(-1) }),
      el("div", { class: "dr-title", text: `${viewYear}년 ${MONTHS[viewMonth]}` }),
      el("button", { class: "dr-nav", type: "button", text: "›", onclick: () => shift(1) }),
    ]);

    const grid = el("div", { class: "dr-grid" });
    for (const w of WEEK) grid.append(el("div", { class: "dr-wk", text: w }));

    const first = new Date(viewYear, viewMonth, 1).getDay();
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el("div", { class: "dr-cell empty" }));

    for (let d = 1; d <= days; d++) {
      const dayIso = iso(viewYear, viewMonth, d);
      const isStart = dayIso === selStart;
      const isEnd = dayIso === selEnd;
      const inRange = selStart && selEnd && dayIso > selStart && dayIso < selEnd;
      const cls =
        "dr-cell" +
        (isStart ? " start" : "") +
        (isEnd ? " end" : "") +
        (inRange ? " inrange" : "") +
        (isStart || isEnd ? " sel" : "");
      grid.append(el("button", { class: cls, type: "button", text: String(d), onclick: () => pick(dayIso) }));
    }

    const foot = el("div", { class: "dr-foot" }, [
      el("button", {
        class: "dr-clear",
        type: "button",
        text: "지우기",
        onclick: () => {
          selStart = selEnd = null;
          commit();
          drawCal();
        },
      }),
      el("button", { class: "dr-done", type: "button", text: "닫기", onclick: closePop }),
    ]);

    pop.append(head, grid, foot);
  }

  function shift(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    else if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    drawCal();
  }

  trigger.addEventListener("click", openPop);
  return root;
}
