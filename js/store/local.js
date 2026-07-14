// 로컬 저장 계층.
//  - 기록(방문/일지/루트 날짜): localStorage에 JSON 하나 (semap1_user_v1)
//  - 일지 사진 원본: IndexedDB (localStorage 용량 한계 때문)
// GitHub 동기화(store/github-sync.js)는 이 계층 위에서 동작한다.

const LS_KEY = "semap1_user_v1";

export function emptyState() {
  return { visits: {}, journal: {}, route: {}, updatedAt: 0 };
}

export function readState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyState();
    const state = JSON.parse(raw);
    return { ...emptyState(), ...state };
  } catch {
    return emptyState();
  }
}

export function writeState(state) {
  state.updatedAt = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ---- IndexedDB: 사진 blob 저장 ----

const DB_NAME = "semap1";
const PHOTO_STORE = "photos";
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PHOTO_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, mode) {
  return db.transaction(PHOTO_STORE, mode).objectStore(PHOTO_STORE);
}

export async function putPhoto(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").put({ id, blob, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").get(id);
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listPhotoIds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
