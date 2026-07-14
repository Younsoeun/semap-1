// JSON 내보내기/가져오기 — PAT 동기화 없이 쓰는 백업 폴백.
// 사진은 용량 문제로 포함하지 않는다(사진은 GitHub 동기화 또는 기기 로컬 유지).

import { readState } from "./local.js";
import * as visits from "./visits.js";

export function exportBackup() {
  const payload = {
    app: "semap1",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: readState(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `semap-기록-${payload.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importBackup(file) {
  return file.text().then((text) => {
    const payload = JSON.parse(text);
    if (payload.app !== "semap1" || !payload.state) {
      throw new Error("SEMap 백업 파일이 아닙니다");
    }
    visits.replaceState(payload.state);
  });
}
