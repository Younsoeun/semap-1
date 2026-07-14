// 해시 라우터.
//   #/                     지구본(홈)
//   #/country/:key         국가 상세
//   #/city/:key/:cityId    도시 상세
//   #/culture[/:key]       문화
//   #/route                방문 루트
//   #/journal              일지 모아보기
//   #/settings             설정·동기화

export function parseRoute(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: "home" };
  switch (parts[0]) {
    case "country":
      return parts[1] ? { name: "country", key: parts[1] } : { name: "home" };
    case "city":
      return parts[2]
        ? { name: "city", key: parts[1], cityId: parts[2] }
        : { name: "home" };
    case "culture":
      return { name: "culture", key: parts[1] || null };
    case "route":
      return { name: "route" };
    case "journal":
      return { name: "journal" };
    case "settings":
      return { name: "settings" };
    default:
      return { name: "home" };
  }
}

export function startRouter(onRoute) {
  const handler = () => onRoute(parseRoute());
  window.addEventListener("hashchange", handler);
  handler();
}

export function navigate(hash) {
  if (location.hash === hash) return;
  location.hash = hash;
}
