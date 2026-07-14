// Builds SEMap_1's geographic data from Natural Earth GeoJSON:
//
//   data/geo/world.json           — GeoJSON features for the 3D globe
//                                   (content countries carry a `key`; their
//                                   geometry is clipped to the mainland bbox,
//                                   with the remainder kept as plain land)
//   data/geo/countries/<key>.json — per-country SVG detail map (outline +
//                                   admin-1 districts, precomputed paths +
//                                   projection params for city markers)
//
// Sources are cached; the legacy SE_map project's data-cache is reused if
// present so nothing is re-downloaded.
//
// Usage: node build/fetch-geo.mjs

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LEGACY_CACHE = "C:\\Users\\0218y\\SE_map\\data-cache";
const CACHE_DIR = existsSync(LEGACY_CACHE)
  ? LEGACY_CACHE
  : path.join(ROOT, "data-cache");
const OUT_DIR = path.join(ROOT, "data", "geo");

const SOURCES = {
  world110: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  admin0_50m: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  admin1_10m: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
};

// One entry per country with content. `mainlandBBox` clips overseas
// territories that share the ADMIN name (e.g. French Guiana) out of the
// interactive/fillable globe polygon. `fromScale: "50m"` pulls the globe
// feature from the 50m dataset for countries missing at 110m (Malta) or
// carved out of another ADMIN (Canary Islands).
const COUNTRIES = [
  { admin: "Portugal", key: "portugal",
    mainlandBBox: { minLon: -9.6, maxLon: -6.1, minLat: 36.8, maxLat: 42.2 },
    viewBox: { w: 600, h: 760, pad: 24 } },
  { admin: "France", key: "france",
    mainlandBBox: { minLon: -5.3, maxLon: 9.7, minLat: 41.2, maxLat: 51.2 },
    viewBox: { w: 680, h: 700, pad: 24 } },
  { admin: "Spain", key: "spain",
    mainlandBBox: { minLon: -9.6, maxLon: 3.4, minLat: 35.9, maxLat: 43.9 },
    viewBox: { w: 720, h: 620, pad: 24 } },
  { admin: "Greece", key: "greece",
    mainlandBBox: { minLon: 19.2, maxLon: 28.4, minLat: 34.6, maxLat: 41.8 },
    viewBox: { w: 700, h: 640, pad: 24 } },
  { admin: "Italy", key: "italy",
    mainlandBBox: { minLon: 6.5, maxLon: 18.6, minLat: 36.5, maxLat: 47.1 },
    viewBox: { w: 560, h: 720, pad: 24 } },
  { admin: "Morocco", key: "morocco",
    mainlandBBox: { minLon: -13.5, maxLon: -0.9, minLat: 27.5, maxLat: 36.1 },
    viewBox: { w: 700, h: 640, pad: 24 } },
  { admin: "Malta", key: "malta", fromScale: "50m",
    mainlandBBox: { minLon: 14.1, maxLon: 14.62, minLat: 35.78, maxLat: 36.10 },
    viewBox: { w: 680, h: 560, pad: 24 } },
  { admin: "Croatia", key: "croatia",
    mainlandBBox: { minLon: 13.3, maxLon: 19.5, minLat: 42.3, maxLat: 46.6 },
    viewBox: { w: 680, h: 640, pad: 24 } },
  { admin: "Netherlands", key: "netherlands",
    mainlandBBox: { minLon: 3.2, maxLon: 7.3, minLat: 50.7, maxLat: 53.6 },
    viewBox: { w: 560, h: 620, pad: 24 } },
  { admin: "Germany", key: "germany",
    mainlandBBox: { minLon: 5.8, maxLon: 15.1, minLat: 47.2, maxLat: 55.1 },
    viewBox: { w: 620, h: 700, pad: 24 } },
  { admin: "Switzerland", key: "switzerland",
    mainlandBBox: { minLon: 5.9, maxLon: 10.6, minLat: 45.7, maxLat: 47.9 },
    viewBox: { w: 780, h: 480, pad: 24 } },
  { admin: "Norway", key: "norway",
    mainlandBBox: { minLon: 4.0, maxLon: 31.5, minLat: 57.8, maxLat: 71.3 },
    viewBox: { w: 620, h: 760, pad: 24 } },
  { admin: "Sweden", key: "sweden",
    mainlandBBox: { minLon: 10.9, maxLon: 24.2, minLat: 55.2, maxLat: 69.1 },
    viewBox: { w: 500, h: 780, pad: 24 } },
  { admin: "Denmark", key: "denmark",
    mainlandBBox: { minLon: 8.0, maxLon: 12.8, minLat: 54.5, maxLat: 57.8 },
    viewBox: { w: 640, h: 560, pad: 24 } },
  { admin: "Finland", key: "finland",
    mainlandBBox: { minLon: 19.3, maxLon: 31.6, minLat: 59.7, maxLat: 70.1 },
    viewBox: { w: 520, h: 760, pad: 24 } },
  { admin: "Iceland", key: "iceland",
    mainlandBBox: { minLon: -24.6, maxLon: -13.4, minLat: 63.3, maxLat: 66.6 },
    viewBox: { w: 760, h: 500, pad: 24 } },
  { admin: "Czechia", key: "czechia", admin1Name: "Czech Republic",
    mainlandBBox: { minLon: 12.0, maxLon: 18.9, minLat: 48.5, maxLat: 51.1 },
    viewBox: { w: 720, h: 460, pad: 24 } },
  { admin: "Austria", key: "austria",
    mainlandBBox: { minLon: 9.5, maxLon: 17.2, minLat: 46.3, maxLat: 49.1 },
    viewBox: { w: 760, h: 400, pad: 24 } },
  { admin: "Hungary", key: "hungary",
    mainlandBBox: { minLon: 16.1, maxLon: 22.9, minLat: 45.7, maxLat: 48.6 },
    viewBox: { w: 720, h: 440, pad: 24 } },
  { admin: "Poland", key: "poland",
    mainlandBBox: { minLon: 14.1, maxLon: 24.2, minLat: 49.0, maxLat: 54.9 },
    viewBox: { w: 680, h: 560, pad: 24 } },
  { admin: "Slovenia", key: "slovenia", noDistricts: true,
    mainlandBBox: { minLon: 13.3, maxLon: 16.6, minLat: 45.4, maxLat: 46.9 },
    viewBox: { w: 760, h: 460, pad: 24 } },
  { admin: "Slovakia", key: "slovakia",
    mainlandBBox: { minLon: 16.8, maxLon: 22.6, minLat: 47.7, maxLat: 49.7 },
    viewBox: { w: 780, h: 400, pad: 24 } },
  { admin: "Romania", key: "romania",
    mainlandBBox: { minLon: 20.2, maxLon: 29.8, minLat: 43.5, maxLat: 48.3 },
    viewBox: { w: 720, h: 460, pad: 24 } },
  { admin: "Bulgaria", key: "bulgaria",
    mainlandBBox: { minLon: 22.3, maxLon: 28.7, minLat: 41.2, maxLat: 44.3 },
    viewBox: { w: 760, h: 420, pad: 24 } },
  { admin: "Estonia", key: "estonia",
    mainlandBBox: { minLon: 21.6, maxLon: 28.3, minLat: 57.4, maxLat: 59.8 },
    viewBox: { w: 760, h: 380, pad: 24 } },
  { admin: "Latvia", key: "latvia", noDistricts: true,
    mainlandBBox: { minLon: 20.9, maxLon: 28.3, minLat: 55.6, maxLat: 58.1 },
    viewBox: { w: 760, h: 360, pad: 24 } },
  { admin: "Lithuania", key: "lithuania",
    mainlandBBox: { minLon: 20.9, maxLon: 26.9, minLat: 53.8, maxLat: 56.5 },
    viewBox: { w: 740, h: 420, pad: 24 } },
  { admin: "Ireland", key: "ireland",
    mainlandBBox: { minLon: -10.7, maxLon: -5.9, minLat: 51.4, maxLat: 55.5 },
    viewBox: { w: 600, h: 640, pad: 24 } },
  { admin: "United Kingdom", key: "uk", noDistricts: true,
    mainlandBBox: { minLon: -8.3, maxLon: 1.9, minLat: 49.8, maxLat: 59.2 },
    viewBox: { w: 560, h: 720, pad: 24 } },
  { admin: "Belgium", key: "belgium",
    mainlandBBox: { minLon: 2.5, maxLon: 6.5, minLat: 49.4, maxLat: 51.6 },
    viewBox: { w: 720, h: 440, pad: 24 } },
  { admin: "Luxembourg", key: "luxembourg",
    mainlandBBox: { minLon: 5.6, maxLon: 6.6, minLat: 49.4, maxLat: 50.2 },
    viewBox: { w: 520, h: 640, pad: 24 } },
  { admin: "Spain", key: "canary", fromScale: "50m",
    mainlandBBox: { minLon: -18.3, maxLon: -13.3, minLat: 27.5, maxLat: 29.5 },
    viewBox: { w: 780, h: 380, pad: 24 } },
];

async function fetchCached(name, url) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, name);
  if (existsSync(cachePath)) {
    console.log(`[cache] ${name}`);
    return JSON.parse(await readFile(cachePath, "utf8"));
  }
  console.log(`[fetch] ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  await writeFile(cachePath, text, "utf8");
  return JSON.parse(text);
}

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

// ---- geometry helpers ----

function allRings(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const rings = [];
  for (const polygon of polygons) for (const ring of polygon) rings.push(ring);
  return rings;
}

function bboxOfRings(rings) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

function bboxOverlaps(b, bbox) {
  return (
    b.maxLon >= bbox.minLon && b.minLon <= bbox.maxLon &&
    b.maxLat >= bbox.minLat && b.minLat <= bbox.maxLat
  );
}

function featureOverlapsBBox(geometry, bbox) {
  return bboxOverlaps(bboxOfRings(allRings(geometry)), bbox);
}

// Split a country's polygons into [inside bbox, outside bbox] by outer ring.
function splitMainland(geometry, bbox) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const inside = [], outside = [];
  for (const polygon of polygons) {
    (bboxOverlaps(bboxOfRings([polygon[0]]), bbox) ? inside : outside).push(polygon);
  }
  return [
    { type: "MultiPolygon", coordinates: inside },
    { type: "MultiPolygon", coordinates: outside },
  ];
}

function roundGeometry(geometry, d = 3) {
  const mapRing = (ring) => ring.map(([lon, lat]) => [round(lon, d), round(lat, d)]);
  if (geometry.type === "Polygon")
    return { type: "Polygon", coordinates: geometry.coordinates.map(mapRing) };
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((p) => p.map(mapRing)),
  };
}

// ---- globe data (data/geo/world.json) ----

function buildWorld(admin0_110m, admin0_50m) {
  const byAdmin = new Map();
  for (const c of COUNTRIES) {
    if (!byAdmin.has(c.admin)) byAdmin.set(c.admin, []);
    byAdmin.get(c.admin).push(c);
  }

  const features = [];
  const seenKeys = new Set();

  for (const f of admin0_110m.features) {
    const name = f.properties.ADMIN || f.properties.NAME;
    const entries = (byAdmin.get(name) || []).filter((c) => c.fromScale !== "50m");
    if (!entries.length) {
      features.push(feature(name, null, f.geometry));
      continue;
    }
    // Content country: mainland becomes the interactive polygon, the
    // remainder (overseas territories, far islands) stays as plain land.
    let rest = f.geometry;
    for (const c of entries) {
      const [inside, outside] = splitMainland(rest, c.mainlandBBox);
      features.push(feature(name, c.key, inside));
      seenKeys.add(c.key);
      rest = outside;
    }
    if (rest.coordinates.length) features.push(feature(name, null, rest));
  }

  // Countries/subregions missing at 110m (Malta) or carved from another
  // ADMIN (Canary Islands) come from the 50m dataset.
  for (const c of COUNTRIES.filter((c) => c.fromScale === "50m")) {
    const src = admin0_50m.features.find((f) => f.properties.ADMIN === c.admin);
    if (!src) throw new Error(`No 50m feature for ${c.admin}`);
    const [inside] = splitMainland(src.geometry, c.mainlandBBox);
    features.push(feature(c.admin, c.key, inside));
    seenKeys.add(c.key);
  }

  const missing = COUNTRIES.filter((c) => !seenKeys.has(c.key));
  if (missing.length)
    throw new Error(`Globe features missing for: ${missing.map((c) => c.key)}`);

  return { type: "FeatureCollection", features };

  function feature(name, key, geometry) {
    return {
      type: "Feature",
      properties: { name, key },
      geometry: roundGeometry(geometry, 3),
    };
  }
}

// ---- per-country SVG detail maps (same approach as legacy SE_map) ----

function ringToPath(ring, project) {
  return ring
    .map(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      return `${i === 0 ? "M" : "L"}${round(x)},${round(y)}`;
    })
    .join(" ") + " Z";
}

function geometryToPath(geometry, project) {
  if (!geometry) return "";
  const parts = [];
  for (const ring of allRings(geometry)) parts.push(ringToPath(ring, project));
  return parts.join(" ");
}

function makeLocalProjection(rings, viewBoxSpec) {
  const bbox = bboxOfRings(rings);
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const cos = Math.cos((centerLat * Math.PI) / 180);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      const x = lon * cos;
      const y = -lat;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const { w, h, pad } = viewBoxSpec;
  const availW = w - pad * 2;
  const availH = h - pad * 2;
  const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
  const offsetX = pad + (availW - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = pad + (availH - (maxY - minY) * scale) / 2 - minY * scale;

  return {
    centerLat, scale, offsetX, offsetY,
    project: (lon, lat) => [lon * cos * scale + offsetX, -lat * scale + offsetY],
  };
}

function buildCountry(country, admin0_50m, admin1_10m) {
  const outlineFeature = admin0_50m.features.find(
    (f) => f.properties.ADMIN === country.admin
  );
  if (!outlineFeature) throw new Error(`No admin-0 feature for ${country.admin}`);
  const [mainlandGeom] = splitMainland(outlineFeature.geometry, country.mainlandBBox);

  const admin1Name = country.admin1Name || country.admin;
  const districtFeatures = country.noDistricts
    ? []
    : admin1_10m.features.filter(
        (f) =>
          f.properties.admin === admin1Name &&
          featureOverlapsBBox(f.geometry, country.mainlandBBox)
      );

  const proj = makeLocalProjection(
    [...allRings(mainlandGeom), ...districtFeatures.flatMap((f) => allRings(f.geometry))],
    country.viewBox
  );

  return {
    key: country.key,
    admin: country.admin,
    viewBox: `0 0 ${country.viewBox.w} ${country.viewBox.h}`,
    projection: {
      centerLat: round(proj.centerLat, 6),
      scale: round(proj.scale, 6),
      offsetX: round(proj.offsetX, 6),
      offsetY: round(proj.offsetY, 6),
    },
    outline: geometryToPath(mainlandGeom, proj.project),
    districts: districtFeatures.map((f) => ({
      name: f.properties.name,
      path: geometryToPath(f.geometry, proj.project),
    })),
  };
}

async function main() {
  const [world110, admin0_50m, admin1_10m] = await Promise.all([
    fetchCached("ne_110m_admin_0_countries.geojson", SOURCES.world110),
    fetchCached("ne_50m_admin_0_countries.geojson", SOURCES.admin0_50m),
    fetchCached("ne_10m_admin_1_states_provinces.geojson", SOURCES.admin1_10m),
  ]);

  await mkdir(path.join(OUT_DIR, "countries"), { recursive: true });

  const world = buildWorld(world110, admin0_50m);
  const worldJson = JSON.stringify(world);
  await writeFile(path.join(OUT_DIR, "world.json"), worldJson, "utf8");
  console.log(`[write] data/geo/world.json (${(worldJson.length / 1024).toFixed(0)} KB)`);

  for (const c of COUNTRIES) {
    const data = buildCountry(c, admin0_50m, admin1_10m);
    await writeFile(
      path.join(OUT_DIR, "countries", `${c.key}.json`),
      JSON.stringify(data),
      "utf8"
    );
    console.log(`[write] data/geo/countries/${c.key}.json (${data.districts.length} districts)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
