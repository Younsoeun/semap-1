// 라이트/다크 테마 토글. 기본은 다크(심야 천문대), 선택은 localStorage 유지.

const KEY = "semap1_theme";
const listeners = [];

export function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function onThemeChange(fn) {
  listeners.push(fn);
}

export function initTheme(toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(KEY, next);
    for (const fn of listeners) fn(next);
  });
}
