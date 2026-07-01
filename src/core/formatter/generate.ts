// Assemble the three output formats (Markdown table / Markdown list / TSV) for
// the detail and index screens. kintone-independent; the tested core.

import type {
  FieldMeta,
  FieldValue,
  FormatOptions,
  KintoneRecord,
  OutputFormat,
  StringifyContext,
} from "../types";
import { escapeListValue, escapeTableCell, escapeTsvCell } from "./escape";
import { stringifyField } from "./stringify";

export type GenerateResult =
  { ok: true; text: string; rowCount: number } | { ok: false; reason: "no-columns" };

interface GenerateOptions {
  format: FormatOptions;
  timeZone: string;
}

function ctxFor(meta: FieldMeta, opts: GenerateOptions): StringifyContext {
  return { format: opts.format, timeZone: opts.timeZone, calcFormat: meta.calcFormat };
}

function emptyFieldValue(meta: FieldMeta): FieldValue {
  return { type: meta.type, value: meta.type === "SUBTABLE" ? [] : "" };
}

function cellText(record: KintoneRecord, meta: FieldMeta, opts: GenerateOptions): string {
  const fv = record[meta.code] ?? emptyFieldValue(meta);
  return stringifyField(fv, ctxFor(meta, opts));
}

function tableRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

// ----- Subtable rendering (detail only, FR-7 / EC-19) -----

interface SubRow {
  value?: Record<string, FieldValue>;
}

function subRows(record: KintoneRecord, meta: FieldMeta): SubRow[] {
  const v = record[meta.code]?.value;
  return Array.isArray(v) ? (v as SubRow[]) : [];
}

function subCell(row: SubRow, inner: FieldMeta, opts: GenerateOptions): string {
  const fv = row.value?.[inner.code] ?? emptyFieldValue(inner);
  return stringifyField(fv, ctxFor(inner, opts));
}

function renderSubtableDetail(
  record: KintoneRecord,
  meta: FieldMeta,
  format: OutputFormat,
  opts: GenerateOptions,
): string {
  const inners = meta.subFields ?? [];
  const rows = subRows(record, meta);

  if (rows.length === 0) {
    // EC-19: no table, just the label and "(0行)".
    if (format === "list") return `- ${meta.label}:\n  (0行)`;
    return `${meta.label}\n(0行)`;
  }

  if (format === "list") {
    const items = rows.map((r) => {
      const pairs = inners.map((m) => `${m.label}: ${escapeListValue(subCell(r, m, opts))}`);
      return `  - ${pairs.join(", ")}`;
    });
    return [`- ${meta.label}:`, ...items].join("\n");
  }

  if (format === "tsv") {
    // Labels are app-defined text and can carry tabs or newlines; give them
    // the same escaping as values or the grid shape breaks.
    const header = inners.map((m) => escapeTsvCell(m.label)).join("\t");
    const dataRows = rows.map((r) =>
      inners.map((m) => escapeTsvCell(subCell(r, m, opts))).join("\t"),
    );
    return [escapeTsvCell(meta.label), header, ...dataRows].join("\n");
  }

  // Markdown table.
  const header = tableRow(inners.map((m) => escapeTableCell(m.label)));
  const sep = tableRow(inners.map(() => "---"));
  const dataRows = rows.map((r) =>
    tableRow(inners.map((m) => escapeTableCell(subCell(r, m, opts)))),
  );
  return [meta.label, header, sep, ...dataRows].join("\n");
}

// ----- Detail screen (縦持ち) -----

export function generateDetail(
  record: KintoneRecord,
  columns: FieldMeta[],
  format: OutputFormat,
  opts: GenerateOptions,
): GenerateResult {
  if (columns.length === 0) return { ok: false, reason: "no-columns" };

  const bodyCols = columns.filter((c) => c.type !== "SUBTABLE");
  const subCols = columns.filter((c) => c.type === "SUBTABLE");

  let body: string;
  if (format === "list") {
    body = bodyCols
      .map((c) => `- ${c.label}: ${escapeListValue(cellText(record, c, opts))}`)
      .join("\n");
  } else if (format === "tsv") {
    body = bodyCols
      .map((c) => `${escapeTsvCell(c.label)}\t${escapeTsvCell(cellText(record, c, opts))}`)
      .join("\n");
  } else {
    const header = tableRow(["フィールド", "値"]);
    const sep = tableRow(["---", "---"]);
    const rows = bodyCols.map((c) =>
      tableRow([escapeTableCell(c.label), escapeTableCell(cellText(record, c, opts))]),
    );
    body = [header, sep, ...rows].join("\n");
  }

  const subBlocks = subCols.map((c) => renderSubtableDetail(record, c, format, opts));
  const text = [body, ...subBlocks].filter((s) => s.length > 0).join("\n\n");
  // FR-21: row count is the number of body fields, subtable rows excluded.
  return { ok: true, text, rowCount: bodyCols.length };
}

// ----- Index screen (横持ち) -----

export function generateIndex(
  records: KintoneRecord[],
  columns: FieldMeta[],
  format: OutputFormat,
  opts: GenerateOptions,
): GenerateResult {
  if (columns.length === 0) return { ok: false, reason: "no-columns" };

  const labels = columns.map((c) => c.label);

  let text: string;
  if (format === "list") {
    text = records
      .map((rec) => {
        const first = escapeListValue(cellText(rec, columns[0], opts));
        const rest = columns
          .slice(1)
          .map((c) => `  - ${c.label}: ${escapeListValue(cellText(rec, c, opts))}`);
        return [`- ${first}`, ...rest].join("\n");
      })
      .join("\n");
  } else if (format === "tsv") {
    const header = labels.map((l) => escapeTsvCell(l)).join("\t");
    const rows = records.map((rec) =>
      columns.map((c) => escapeTsvCell(cellText(rec, c, opts))).join("\t"),
    );
    text = [header, ...rows].join("\n");
  } else {
    const header = tableRow(labels.map((l) => escapeTableCell(l)));
    const sep = tableRow(columns.map(() => "---"));
    const rows = records.map((rec) =>
      tableRow(columns.map((c) => escapeTableCell(cellText(rec, c, opts)))),
    );
    text = [header, sep, ...rows].join("\n");
  }

  return { ok: true, text, rowCount: records.length };
}
