// One-time migration: converts the legacy SE_map project's window-global JS
// data files into SEMap_1's JSON content files.
//
// Usage: node build/migrate-from-semap.mjs [path-to-old-SE_map]

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OLD_ROOT = process.argv[2] || "C:\\Users\\0218y\\SE_map";
const OLD_JS = path.join(OLD_ROOT, "js");
const OUT = path.join(ROOT, "data", "content");

// Execute a legacy script that assigns onto `window` and return that window.
async function loadLegacy(file, win = {}) {
  const code = await readFile(path.join(OLD_JS, file), "utf8");
  new Function("window", code)(win);
  return win;
}

async function writeJson(rel, data) {
  const file = path.join(OUT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 1), "utf8");
  console.log(`[write] data/content/${rel}`);
}

async function main() {
  // ---- countries (data-*.js all share window.SE_MAP_DATA) ----
  const win = {};
  const files = (await readdir(OLD_JS)).filter((f) => /^data-.*\.js$/.test(f));
  for (const f of files) await loadLegacy(f, win);
  const countries = win.SE_MAP_DATA || {};
  const index = [];
  for (const [key, c] of Object.entries(countries)) {
    await writeJson(path.join("countries", `${key}.json`), c);
    index.push({
      key,
      admin: c.admin,
      nameKo: c.nameKo,
      nameEn: c.nameEn,
      cities: c.cities.length,
      attractions: c.attractions.length,
    });
  }
  await writeJson("index.json", { countries: index });

  // ---- culture / images / route ----
  const { SE_MAP_CULTURE } = await loadLegacy("culture-data.js");
  await writeJson("culture.json", SE_MAP_CULTURE);

  const { SE_MAP_IMAGES } = await loadLegacy("images.js");
  await writeJson("images.json", SE_MAP_IMAGES);

  const { SE_MAP_ROUTE } = await loadLegacy("route-data.js");
  await writeJson("route.json", SE_MAP_ROUTE);

  console.log(`Done: ${index.length} countries migrated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
