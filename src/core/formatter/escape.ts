// Per-format escaping (FR-16 / EC-1..EC-4).

// Normalize CRLF / CR to LF so downstream rules see a single newline form.
function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

// Markdown table cell: escape pipes and turn newlines into <br>.
export function escapeTableCell(value: string): string {
  return normalizeNewlines(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

// Markdown list item value: newlines become a continuation line
// ("\n" + two spaces) so the text stays inside the list item (FR-5).
// Pipes are not escaped in list output.
export function escapeListValue(value: string): string {
  return normalizeNewlines(value).replace(/\n/g, "\n  ");
}

// TSV cell: tabs and newlines each collapse to a single space (FR-16 / EC-3).
export function escapeTsvCell(value: string): string {
  return normalizeNewlines(value).replace(/[\t\n]/g, " ");
}
