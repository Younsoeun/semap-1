// 설정 — GitHub 동기화(레포/PAT), 수동 동기화, JSON 백업, 안내.

import { el, fmtTimestamp } from "../ui.js";
import { syncConfig, setSyncConfig, syncNow, syncStatus, onSyncStatus } from "../store/github-sync.js";
import { exportBackup, importBackup } from "../store/backup.js";

export async function renderSettings(container, { toast }) {
  const cfg = syncConfig() || {};

  const repoInput = el("input", {
    type: "text",
    placeholder: "예: Younsoeun/semap-data (개인 기록용 private 저장소)",
    value: cfg.repo || "",
    autocapitalize: "off",
    spellcheck: "false",
  });
  const branchInput = el("input", {
    type: "text",
    placeholder: "main",
    value: cfg.branch || "main",
  });
  const tokenInput = el("input", {
    type: "password",
    placeholder: "github_pat_…",
    value: cfg.token || "",
  });

  const statusEl = el("div", { class: "sync-status" });

  function renderStatus() {
    if (!syncStatus.configured) {
      statusEl.className = "sync-status";
      statusEl.textContent = "동기화 미설정 — 기록은 이 기기에만 저장됩니다.";
      return;
    }
    if (syncStatus.syncing) {
      statusEl.className = "sync-status";
      statusEl.textContent = "동기화 중…";
    } else if (syncStatus.lastError) {
      statusEl.className = "sync-status";
      statusEl.textContent = `동기화 실패: ${syncStatus.lastError}`;
    } else if (syncStatus.lastSync) {
      statusEl.className = "sync-status ok";
      statusEl.textContent = `마지막 동기화: ${fmtTimestamp(syncStatus.lastSync)} ${new Date(
        syncStatus.lastSync
      ).toLocaleTimeString("ko-KR")}`;
    } else {
      statusEl.className = "sync-status";
      statusEl.textContent = "설정됨 — 아직 동기화 전입니다.";
    }
  }
  renderStatus();
  onSyncStatus(renderStatus);

  const fileInput = el("input", { type: "file", accept: ".json", style: "display:none" });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      await importBackup(file);
      toast("백업을 가져왔습니다");
    } catch (err) {
      toast(`가져오기 실패: ${err.message}`);
    }
    fileInput.value = "";
  });

  const page = el("div", { class: "page" }, [
    el("div", { class: "page-head" }, [
      el("h1", { text: "설정" }),
      el("span", { class: "en", text: "SETTINGS" }),
    ]),

    el("div", { class: "settings-block panel panel-pad" }, [
      el("h2", { text: "기기 간 동기화 (GitHub)" }),
      el("p", {
        class: "desc",
        text:
          "방문 기록과 일지·사진을 개인용 private 저장소(data/user/)에 자동 커밋해 폰↔노트북이 같은 기록을 보게 합니다. " +
          "앱 코드 저장소와 분리된 private 저장소를 쓰면 개인 기록이 공개되지 않습니다. " +
          "그 저장소의 Contents 읽기/쓰기 권한만 가진 fine-grained 토큰을 발급해 붙여넣으세요. " +
          "토큰은 이 기기(브라우저)에만 저장됩니다.",
      }),
      el("label", { class: "field", text: "저장소 (owner/repo)" }),
      repoInput,
      el("label", { class: "field", text: "브랜치" }),
      branchInput,
      el("label", { class: "field", text: "Personal Access Token" }),
      tokenInput,
      el("div", { class: "settings-actions" }, [
        el("button", {
          class: "btn primary",
          text: "저장 후 동기화",
          onclick: async () => {
            const repo = repoInput.value.trim();
            const token = tokenInput.value.trim();
            if (!repo || !token) {
              toast("저장소와 토큰을 입력하세요");
              return;
            }
            setSyncConfig({ repo, branch: branchInput.value.trim() || "main", token });
            await syncNow();
            toast(syncStatus.lastError ? `동기화 실패: ${syncStatus.lastError}` : "동기화 완료");
          },
        }),
        el("button", {
          class: "btn",
          text: "지금 동기화",
          onclick: async () => {
            await syncNow();
            toast(syncStatus.lastError ? `동기화 실패: ${syncStatus.lastError}` : "동기화 완료");
          },
        }),
        el("button", {
          class: "btn danger",
          text: "동기화 해제",
          onclick: () => {
            setSyncConfig(null);
            toast("동기화 설정을 지웠습니다 (기록은 이 기기에 유지)");
          },
        }),
      ]),
      statusEl,
    ]),

    el("div", { class: "settings-block panel panel-pad" }, [
      el("h2", { text: "백업" }),
      el("p", {
        class: "desc",
        text: "동기화를 쓰지 않을 때의 폴백입니다. 기록(방문/일지 텍스트/루트 날짜)을 JSON 파일로 내려받고, 다른 기기에서 가져올 수 있습니다. 사진은 포함되지 않습니다.",
      }),
      el("div", { class: "settings-actions" }, [
        el("button", { class: "btn", text: "JSON 내보내기", onclick: exportBackup }),
        el("button", { class: "btn", text: "JSON 가져오기", onclick: () => fileInput.click() }),
        fileInput,
      ]),
    ]),
  ]);

  container.append(page);
}
