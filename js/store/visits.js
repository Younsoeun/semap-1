// 방문 기록 도메인 모델.
// 모든 기록은 명소(attraction) 단위이며 countryKey를 함께 저장한다 —
// 지구본이 국가별 활성화 여부를 국가 데이터 로드 없이 알 수 있도록.
//
// 변경 시점마다 updatedAt(ms)을 기록해 GitHub 동기화의 키 단위 병합에 쓴다.

import { readState, writeState } from "./local.js";

let state = readState();
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  writeState(state);
  for (const fn of listeners) fn();
}

// 동기화가 원격 상태를 병합한 뒤 통째로 교체할 때 사용
export function replaceState(next) {
  state = next;
  writeState(state);
  for (const fn of listeners) fn();
}

export function rawState() {
  return state;
}

// ---- 방문 여부 · 방문일 ----

export function getVisit(attractionId) {
  return state.visits[attractionId] || null;
}

export function setVisited(attractionId, countryKey, visited) {
  const v = state.visits[attractionId] || {};
  state.visits[attractionId] = {
    ...v,
    country: countryKey,
    visited,
    updatedAt: Date.now(),
  };
  commit();
}

export function setVisitDates(attractionId, countryKey, start, end) {
  const v = state.visits[attractionId] || {};
  state.visits[attractionId] = {
    ...v,
    country: countryKey,
    visited: v.visited ?? false,
    start: start || null,
    end: end || null,
    updatedAt: Date.now(),
  };
  commit();
}

// ---- 일지 (마이크로블로그: 명소당 항목 여러 개) ----

export function journalOf(attractionId) {
  return state.journal[attractionId] || [];
}

export function hasJournal(attractionId) {
  return journalOf(attractionId).length > 0;
}

export function addJournalEntry(attractionId, countryKey, { text, photos = [] }) {
  const now = Date.now();
  const entry = {
    id: `j${now}${Math.random().toString(36).slice(2, 6)}`,
    country: countryKey,
    text,
    photos,
    createdAt: now,
    updatedAt: now,
  };
  state.journal[attractionId] = [...journalOf(attractionId), entry];
  commit();
  return entry;
}

export function updateJournalEntry(attractionId, entryId, patch) {
  state.journal[attractionId] = journalOf(attractionId).map((e) =>
    e.id === entryId ? { ...e, ...patch, updatedAt: Date.now() } : e
  );
  commit();
}

export function deleteJournalEntry(attractionId, entryId) {
  const rest = journalOf(attractionId).filter((e) => e.id !== entryId);
  if (rest.length) state.journal[attractionId] = rest;
  else delete state.journal[attractionId];
  // 삭제도 병합에서 이겨야 하므로 tombstone을 남긴다.
  state.tombstones = state.tombstones || {};
  state.tombstones[entryId] = Date.now();
  commit();
}

// ---- 루트 페이지 날짜 ----

export function routeDates(id) {
  return state.route[id] || null;
}

export function setRouteDates(id, start, end) {
  if (!start && !end) delete state.route[id];
  else state.route[id] = { start: start || null, end: end || null, updatedAt: Date.now() };
  commit();
}

// ---- 파생 상태 ----

// 국가가 "활성화"(지구본 색 변경)되는 조건: 일지 1개 이상 또는 방문 체크 1개 이상
export function activeCountries() {
  const set = new Set();
  for (const v of Object.values(state.visits)) {
    if (v.visited && v.country) set.add(v.country);
  }
  for (const entries of Object.values(state.journal)) {
    for (const e of entries) if (e.country) set.add(e.country);
  }
  return set;
}

export function countryStats(countryKey, attractionIds) {
  let visited = 0;
  for (const id of attractionIds) {
    if (state.visits[id]?.visited) visited += 1;
  }
  return { visited, total: attractionIds.length };
}

export function totals() {
  let visitedAttractions = 0;
  for (const v of Object.values(state.visits)) if (v.visited) visitedAttractions += 1;
  let journalEntries = 0;
  for (const entries of Object.values(state.journal)) journalEntries += entries.length;
  return {
    countries: activeCountries().size,
    attractions: visitedAttractions,
    journalEntries,
  };
}

// 일지 모아보기: [{attractionId, entry}] 최신순
export function allJournalEntries() {
  const out = [];
  for (const [attractionId, entries] of Object.entries(state.journal)) {
    for (const entry of entries) out.push({ attractionId, entry });
  }
  out.sort((a, b) => b.entry.createdAt - a.entry.createdAt);
  return out;
}
