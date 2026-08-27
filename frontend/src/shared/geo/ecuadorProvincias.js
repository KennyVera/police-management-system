const GEO_URLS = [
  "/geo/provincias_ecuador.geojson",
  "/static/data/provincias_ecuador.geojson",
];

const SESSION_KEY = "sgp_geo_provincias_v1";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let memoryCache = null;
let inflight = null;

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || Date.now() - (parsed.at || 0) > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache(data) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    /* quota / private mode */
  }
}

export async function fetchProvinciasGeoJSON({ force = false } = {}) {
  if (!force && memoryCache) return memoryCache;

  if (!force) {
    const fromSession = readSessionCache();
    if (fromSession) {
      memoryCache = fromSession;
      return fromSession;
    }
  }

  if (inflight && !force) return inflight;

  inflight = (async () => {
    for (const url of GEO_URLS) {
      try {
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) continue;
        const data = await res.json();
        memoryCache = data;
        writeSessionCache(data);
        return data;
      } catch {
        /* try next url */
      }
    }
    throw new Error("No se pudo cargar el GeoJSON de provincias.");
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function clearProvinciasGeoCache() {
  memoryCache = null;
  inflight = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
