// Query rewriting for list copy (FR-12).

const LIMIT_OFFSET_RE = /\s*limit \d+(?: offset \d+)?\s*$/;

// Remove a trailing "limit N [offset M]" clause from a kintone query string.
// Handles both " ... limit 100 offset 200" and a bare "limit 500 offset 0"
// (kintone returns the latter when no filter or sort is set).
export function stripLimitOffset(query: string): string {
  return query.replace(LIMIT_OFFSET_RE, "");
}

// Build the query used to fetch every record matching the current view,
// preserving the filter and sort but dropping paging and ensuring a stable
// order (FR-12 / EC-21).
export function buildFetchQuery(rawQuery: string): string {
  const base = stripLimitOffset(rawQuery).trim();
  if (/order by/i.test(base)) {
    return base;
  }
  return base ? `${base} order by $id asc` : "order by $id asc";
}
