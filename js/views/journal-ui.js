// 일지 UI 조각 — 일지 카드(소감 카드)와 에디터.
// 도시 상세(city.js)와 일지 모아보기(journal.js)가 함께 쓴다.
//
// 소감 카드 형태: 원형 아바타 대신 방문 체크박스, 아이디 줄 대신 방문 날짜
// 범위, 하단 소셜 아이콘 행 없음.

import * as visits from "../store/visits.js";
import { putPhoto, deletePhoto } from "../store/local.js";
import { el, fmtDateRange, fmtTimestamp, attachPhoto, openLightbox, resizeImage } from "../ui.js";

export function buildJournalCard({ attraction, countryKey, entry, placeLink, onChanged }) {
  const visit = visits.getVisit(attraction.id);
  const card = el("div", { class: `journal-card${visit?.visited ? " visited" : ""}` });

  const dates = fmtDateRange(visit?.start, visit?.end);

  const head = el("div", { class: "head" }, [
    el("div", { class: "who" }, [
      el("div", { class: "place" }, [
        placeLink
          ? el("a", { href: placeLink, text: attraction.nameKo })
          : el("span", { text: attraction.nameKo }),
      ]),
      dates ? el("div", { class: "dates", text: dates }) : null,
    ]),
    el("span", { class: "when", text: fmtTimestamp(entry.createdAt) }),
  ]);

  const photoGrid = entry.photos?.length
    ? el(
        "div",
        { class: "journal-photos" },
        entry.photos.map((pid) => {
          const img = el("img", { alt: "일지 사진", loading: "lazy" });
          attachPhoto(img, pid);
          img.addEventListener("click", () => img.src && openLightbox(img.src));
          return img;
        })
      )
    : null;

  const actions = el("div", { class: "entry-actions" }, [
    el("button", {
      text: "수정",
      onclick: () => {
        const editor = buildJournalEditor({
          attraction,
          countryKey,
          entry,
          onDone: () => onChanged?.(),
          onCancel: () => {
            editor.replaceWith(card);
          },
        });
        card.replaceWith(editor);
      },
    }),
    el("button", {
      text: "삭제",
      onclick: () => {
        if (!confirm("이 일지를 삭제할까요?")) return;
        for (const pid of entry.photos || []) deletePhoto(pid).catch(() => {});
        visits.deleteJournalEntry(attraction.id, entry.id);
        onChanged?.();
      },
    }),
  ]);

  card.append(head, el("p", { class: "text", text: entry.text }), photoGrid, actions);
  return card;
}

export function buildJournalEditor({ attraction, countryKey, entry = null, onDone, onCancel }) {
  const pending = []; // { id, blob, url } — 저장 시 IndexedDB에 기록
  const keepPhotos = [...(entry?.photos || [])];

  const textarea = el("textarea", {
    placeholder: "이곳에서의 생각, 추억을 적어보세요…",
  });
  textarea.value = entry?.text || "";

  const previews = el("div", { class: "photo-previews" });

  function renderPreviews() {
    previews.replaceChildren();
    for (const pid of keepPhotos) {
      const img = el("img", { alt: "" });
      attachPhoto(img, pid);
      previews.append(
        el("div", { class: "ph" }, [
          img,
          el("button", {
            class: "rm",
            text: "✕",
            title: "사진 제거",
            onclick: () => {
              keepPhotos.splice(keepPhotos.indexOf(pid), 1);
              renderPreviews();
            },
          }),
        ])
      );
    }
    for (const p of pending) {
      previews.append(
        el("div", { class: "ph" }, [
          el("img", { src: p.url, alt: "" }),
          el("button", {
            class: "rm",
            text: "✕",
            title: "사진 제거",
            onclick: () => {
              pending.splice(pending.indexOf(p), 1);
              URL.revokeObjectURL(p.url);
              renderPreviews();
            },
          }),
        ])
      );
    }
  }
  renderPreviews();

  const fileInput = el("input", {
    type: "file",
    accept: "image/*",
    multiple: "",
    style: "display:none",
  });
  fileInput.addEventListener("change", async () => {
    for (const file of fileInput.files) {
      const blob = await resizeImage(file);
      const id = `p${Date.now()}${Math.random().toString(36).slice(2, 6)}.jpg`;
      pending.push({ id, blob, url: URL.createObjectURL(blob) });
    }
    fileInput.value = "";
    renderPreviews();
  });

  const save = async () => {
    const text = textarea.value.trim();
    if (!text && !pending.length && !keepPhotos.length) return;
    for (const p of pending) await putPhoto(p.id, p.blob);
    const photos = [...keepPhotos, ...pending.map((p) => p.id)];
    if (entry) {
      // 편집에서 제거된 기존 사진은 로컬에서도 정리
      for (const pid of entry.photos || []) {
        if (!photos.includes(pid)) deletePhoto(pid).catch(() => {});
      }
      visits.updateJournalEntry(attraction.id, entry.id, { text, photos });
    } else {
      visits.addJournalEntry(attraction.id, countryKey, { text, photos });
    }
    onDone?.();
  };

  return el("div", { class: "journal-editor" }, [
    textarea,
    previews,
    el("div", { class: "editor-row" }, [
      el("button", { class: "btn", text: "사진 추가", onclick: () => fileInput.click() }),
      fileInput,
      el("button", { class: "btn primary", text: entry ? "수정 저장" : "일지 저장", onclick: save }),
      onCancel ? el("button", { class: "btn", text: "취소", onclick: onCancel }) : null,
    ]),
  ]);
}
