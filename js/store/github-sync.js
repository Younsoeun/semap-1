// GitHub 저장소를 개인 DB로 쓰는 동기화 계층.
//
// 설정(레포/브랜치/fine-grained PAT)은 기기별 localStorage에 저장하고,
// 기록은 저장소의 data/user/state.json 으로, 일지 사진은
// data/user/photos/<id>.jpg 로 Contents API를 통해 커밋한다.
//
// 병합 규칙: 파일 하나(state.json)를 키 단위 last-write-wins로 병합 —
//   visits/route: 키별 updatedAt 큰 쪽, journal: entry id 단위 합집합 +
//   tombstone(삭제 기록)으로 삭제가 병합에서 이기도록.

import { readState, writeState, emptyState, getPhoto, listPhotoIds } from "./local.js";
import * as visits from "./visits.js";

const CFG_KEY = "semap1_sync_v1";
const UPLOADED_KEY = "semap1_uploaded_photos";
const DIRTY_KEY = "semap1_dirty";
const STATE_PATH = "data/user/state.json";

export const syncStatus = {
  configured: false,
  syncing: false,
  lastSync: null,
  lastError: null,
  listeners: new Set(),
};

function notifyStatus() {
  for (const fn of syncStatus.listeners) fn(syncStatus);
}

export function onSyncStatus(fn) {
  syncStatus.listeners.add(fn);
  return () => syncStatus.listeners.delete(fn);
}

export function syncConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || null;
  } catch {
    return null;
  }
}

export function setSyncConfig(cfg) {
  if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CFG_KEY);
  syncStatus.configured = !!cfg;
  notifyStatus();
}

export function remotePhotoUrl(photoId) {
  const cfg = syncConfig();
  if (!cfg) return null;
  const branch = cfg.branch || "main";
  return `https://raw.githubusercontent.com/${cfg.repo}/${branch}/data/user/photos/${photoId}`;
}

// ---- GitHub Contents API ----

async function gh(cfg, method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${detail.slice(0, 140)}`);
  }
  return res.json();
}

function b64encode(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// ---- 병합 ----

function mergeStates(a, b) {
  const out = emptyState();
  const tombstones = { ...(a.tombstones || {}), ...(b.tombstones || {}) };
  for (const [id, ts] of Object.entries(a.tombstones || {})) {
    tombstones[id] = Math.max(ts, tombstones[id] || 0);
  }
  out.tombstones = tombstones;

  for (const key of ["visits", "route"]) {
    const keys = new Set([...Object.keys(a[key] || {}), ...Object.keys(b[key] || {})]);
    for (const k of keys) {
      const va = a[key]?.[k];
      const vb = b[key]?.[k];
      out[key][k] =
        !va ? vb : !vb ? va : (va.updatedAt || 0) >= (vb.updatedAt || 0) ? va : vb;
    }
  }

  const attractionIds = new Set([
    ...Object.keys(a.journal || {}),
    ...Object.keys(b.journal || {}),
  ]);
  for (const aid of attractionIds) {
    const byId = new Map();
    for (const entry of [...(a.journal?.[aid] || []), ...(b.journal?.[aid] || [])]) {
      if (tombstones[entry.id]) continue;
      const prev = byId.get(entry.id);
      if (!prev || (entry.updatedAt || 0) > (prev.updatedAt || 0)) byId.set(entry.id, entry);
    }
    const entries = [...byId.values()].sort((x, y) => x.createdAt - y.createdAt);
    if (entries.length) out.journal[aid] = entries;
  }

  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}

// ---- pull / push ----

async function pull(cfg) {
  const file = await gh(cfg, "GET", `${STATE_PATH}?ref=${cfg.branch || "main"}`);
  if (!file) return { remote: null, sha: null };
  return { remote: JSON.parse(b64decode(file.content)), sha: file.sha };
}

function uploadedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY)) || []);
  } catch {
    return new Set();
  }
}

async function pushPhotos(cfg) {
  const uploaded = uploadedSet();
  const ids = await listPhotoIds();
  for (const id of ids) {
    if (uploaded.has(id)) continue;
    const blob = await getPhoto(id);
    if (!blob) continue;
    await gh(cfg, "PUT", `data/user/photos/${id}`, {
      message: `사진 추가: ${id}`,
      branch: cfg.branch || "main",
      content: await blobToBase64(blob),
    });
    uploaded.add(id);
    localStorage.setItem(UPLOADED_KEY, JSON.stringify([...uploaded]));
  }
}

async function pushState(cfg, state, sha) {
  await gh(cfg, "PUT", STATE_PATH, {
    message: "여행 기록 동기화",
    branch: cfg.branch || "main",
    content: b64encode(JSON.stringify(state, null, 1)),
    ...(sha ? { sha } : {}),
  });
}

// 전체 동기화 한 사이클: pull → merge → (다르면) replace local → push
export async function syncNow() {
  const cfg = syncConfig();
  if (!cfg || syncStatus.syncing) return;
  syncStatus.syncing = true;
  syncStatus.lastError = null;
  notifyStatus();
  try {
    const local = readState();
    const { remote, sha } = await pull(cfg);
    const merged = remote ? mergeStates(local, remote) : local;

    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      visits.replaceState(merged);
    }

    await pushPhotos(cfg);

    if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) {
      try {
        await pushState(cfg, merged, sha);
      } catch (err) {
        // sha 충돌(다른 기기가 먼저 커밋) → 한 번 재시도
        if (/GitHub API (409|422)/.test(err.message)) {
          const again = await pull(cfg);
          const merged2 = again.remote ? mergeStates(merged, again.remote) : merged;
          visits.replaceState(merged2);
          await pushState(cfg, merged2, again.sha);
        } else {
          throw err;
        }
      }
    }

    localStorage.removeItem(DIRTY_KEY);
    syncStatus.lastSync = Date.now();
  } catch (err) {
    console.error("[sync]", err);
    syncStatus.lastError = err.message;
  } finally {
    syncStatus.syncing = false;
    notifyStatus();
  }
}

// ---- 자동 동기화 ----

let pushTimer = null;

export function initSync({ toast } = {}) {
  syncStatus.configured = !!syncConfig();

  // 기록이 바뀌면 3초 디바운스 후 push (오프라인이면 dirty 표시만)
  visits.subscribe(() => {
    localStorage.setItem(DIRTY_KEY, "1");
    if (!syncConfig()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (navigator.onLine) syncNow();
    }, 3000);
  });

  window.addEventListener("online", () => {
    if (syncConfig() && localStorage.getItem(DIRTY_KEY)) syncNow();
  });

  // 시작 시: 설정돼 있으면 원격 기록을 당겨온다
  if (syncConfig() && navigator.onLine) {
    syncNow().then(() => {
      if (syncStatus.lastError && toast) toast(`동기화 실패: ${syncStatus.lastError}`);
    });
  }
}
