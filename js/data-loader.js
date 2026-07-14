// 정적 콘텐츠 JSON 로더 (fetch + 메모리 캐시).
// 사용자 기록(방문/일지)은 store/가 담당한다 — 여기는 읽기 전용 콘텐츠만.

const cache = new Map();

async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(path).then((res) => {
    if (!res.ok) throw new Error(`${path} 로드 실패 (${res.status})`);
    return res.json();
  });
  cache.set(path, promise);
  return promise;
}

export const getIndex = () => loadJSON("data/content/index.json");
export const getCountry = (key) => loadJSON(`data/content/countries/${key}.json`);
export const getCulture = () => loadJSON("data/content/culture.json");
export const getImages = () => loadJSON("data/content/images.json");
export const getRoute = () => loadJSON("data/content/route.json");
export const getProfiles = () => loadJSON("data/content/profiles.json");
export const getGreetings = () => loadJSON("data/content/greetings.json");
export const getGeoWorld = () => loadJSON("data/geo/world.json");
export const getGeoCountry = (key) => loadJSON(`data/geo/countries/${key}.json`);

// 명소 사진 URL (없으면 null)
export async function imageFor(id) {
  const images = await getImages();
  return images[id] || null;
}
