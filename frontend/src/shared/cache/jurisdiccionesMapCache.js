const SESSION_KEY = "sgp_juris_mapa_v1";
const TTL_MS = 30 * 60 * 1000;

let memoryCache = null;
let memoryAt = 0;
let inflight = null;

function isFresh(at) {
  return at && Date.now() - at < TTL_MS;
}

export function readJurisdiccionesMapCache() {
  if (memoryCache && isFresh(memoryAt)) return memoryCache;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !isFresh(parsed.at)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    memoryCache = parsed.data;
    memoryAt = parsed.at;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeJurisdiccionesMapCache(data) {
  memoryCache = data;
  memoryAt = Date.now();
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ at: memoryAt, data })
    );
  } catch {
    /* ignore */
  }
}

export function clearJurisdiccionesMapCache() {
  memoryCache = null;
  memoryAt = 0;
  inflight = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function refreshJurisdiccionesMapa(apiFetch) {
  if (inflight) return inflight;

  inflight = apiFetch()
    .then((data) => {
      writeJurisdiccionesMapCache(data);
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
