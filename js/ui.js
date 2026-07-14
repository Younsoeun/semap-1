// 공용 UI 헬퍼: 엘리먼트 생성, 날짜 표기, 사진 표시, 라이트박스.

import { getPhoto } from "./store/local.js";
import { remotePhotoUrl } from "./store/github-sync.js";

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child);
  }
  return node;
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// "2026-09-03" → "9월 3일"
export function fmtDate(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
}

export function fmtDateRange(start, end) {
  if (start && end && start !== end) return `${fmtDate(start)} ~ ${fmtDate(end)}`;
  if (start) return fmtDate(start);
  if (end) return fmtDate(end);
  return "";
}

export function fmtTimestamp(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// 사진 id → 표시 가능한 URL. 로컬(IndexedDB) 우선, 없으면 원격(GitHub) 시도.
const objectUrls = new Map();

export async function photoUrl(photoId) {
  if (objectUrls.has(photoId)) return objectUrls.get(photoId);
  try {
    const blob = await getPhoto(photoId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      objectUrls.set(photoId, url);
      return url;
    }
  } catch {
    /* IndexedDB 실패 시 원격 폴백 */
  }
  const remote = await remotePhotoUrl(photoId);
  if (remote) objectUrls.set(photoId, remote);
  return remote;
}

export function attachPhoto(imgEl, photoId) {
  photoUrl(photoId).then((url) => {
    if (url) imgEl.src = url;
    else imgEl.remove();
  });
}

export function openLightbox(src) {
  const box = el("div", { class: "lightbox", onclick: () => box.remove() }, [
    el("img", { src }),
  ]);
  document.body.append(box);
}

// 이미지 파일 → 리사이즈된 JPEG blob (긴 변 1600px, 품질 0.82)
export async function resizeImage(file, maxSize = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82)
  );
}
