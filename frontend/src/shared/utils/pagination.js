/** Normaliza respuesta paginada `{ results, count, ... }` o array legado. */
export function unwrapPage(data) {
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      page: 1,
      page_size: data.length || 10,
      total_pages: 1,
    };
  }
  return {
    results: data?.results || [],
    count: data?.count ?? 0,
    page: data?.page ?? 1,
    page_size: data?.page_size ?? 10,
    total_pages: data?.total_pages ?? 1,
  };
}

export function cleanParams(params = {}) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    out[k] = v;
  });
  return out;
}
