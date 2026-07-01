// Glue between the pure formatter core and the kintone data layer. Produces the
// clipboard text plus the metadata the UI needs for toasts.

import type { KintoneRestAPIClient } from "@kintone/rest-api-client";
import { resolveColumns } from "../core/columns";
import { generateDetail, generateIndex } from "../core/formatter/generate";
import { buildFetchQuery } from "../core/query";
import type { FieldMeta, KintoneRecord, OutputFormat, Profile } from "../core/types";
import { AbortError, fetchAllRecords } from "./fetcher";

export type CopyErrorKind = "fetch" | "no-columns" | "empty" | "write" | "abort";

export interface CopyData {
  text: string;
  rowCount: number; // index: record count; detail: body field count
  totalCount?: number; // index only
  truncated?: boolean; // index only
  permissionExcludedCount: number;
}

export type CopyOutcome = { ok: true; data: CopyData } | { ok: false; error: CopyErrorKind };

function warnDeleted(deletedCodes: string[]): void {
  if (deletedCodes.length > 0) {
    // TODO(spec FR-18): surface an admin-only notice for deleted fields.
    // eslint-disable-next-line no-console
    console.warn(`[kintone-markdown-copy] fields not found in form: ${deletedCodes.join(", ")}`);
  }
}

// Detail screen: synchronous, works from event.record (FR-8/FR-9).
export function assembleDetail(
  record: KintoneRecord,
  formMetas: Map<string, FieldMeta>,
  profile: Profile,
  format: OutputFormat,
  timeZone: string,
): CopyOutcome {
  const available = new Set(Object.keys(record));
  const { columns, permissionExcludedCount, deletedCodes } = resolveColumns(
    profile.fieldCodes,
    formMetas,
    available,
  );
  warnDeleted(deletedCodes);
  if (columns.length === 0) return { ok: false, error: "no-columns" };

  const result = generateDetail(record, columns, format, { format: profile.format, timeZone });
  if (!result.ok) return { ok: false, error: "no-columns" };
  return {
    ok: true,
    data: { text: result.text, rowCount: result.rowCount, permissionExcludedCount },
  };
}

// Index screen: fetches all matching records via cursor (FR-12/FR-13).
export async function assembleIndex(
  client: KintoneRestAPIClient,
  app: number,
  rawQuery: string,
  formMetas: Map<string, FieldMeta>,
  profile: Profile,
  format: OutputFormat,
  timeZone: string,
  limit: number,
  signal: AbortSignal,
): Promise<CopyOutcome> {
  let fetched;
  try {
    fetched = await fetchAllRecords(client, {
      app,
      query: buildFetchQuery(rawQuery),
      limit,
      signal,
    });
  } catch (err) {
    if (err instanceof AbortError) return { ok: false, error: "abort" };
    return { ok: false, error: "fetch" };
  }

  if (fetched.records.length === 0) return { ok: false, error: "empty" };

  const available = new Set(Object.keys(fetched.records[0]));
  const { columns, permissionExcludedCount, deletedCodes } = resolveColumns(
    profile.fieldCodes,
    formMetas,
    available,
  );
  warnDeleted(deletedCodes);
  if (columns.length === 0) return { ok: false, error: "no-columns" };

  const result = generateIndex(fetched.records, columns, format, {
    format: profile.format,
    timeZone,
  });
  if (!result.ok) return { ok: false, error: "no-columns" };
  return {
    ok: true,
    data: {
      text: result.text,
      rowCount: result.rowCount,
      totalCount: fetched.totalCount,
      truncated: fetched.truncated,
      permissionExcludedCount,
    },
  };
}
