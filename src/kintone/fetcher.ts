import type { KintoneRestAPIClient } from "@kintone/rest-api-client";
import type { KintoneRecord } from "../core/types";

export class AbortError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortError";
  }
}

export interface FetchParams {
  app: number;
  query: string;
  limit: number;
  signal?: AbortSignal;
}

export interface FetchResult {
  records: KintoneRecord[];
  totalCount: number;
  truncated: boolean;
}

function isCursorExpired(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  // GAIA_CU01: the cursor no longer exists (expired or already consumed).
  return code === "GAIA_CU01";
}

async function drainCursor(
  client: KintoneRestAPIClient,
  cursorId: string,
  limit: number,
  signal?: AbortSignal,
): Promise<KintoneRecord[]> {
  const records: KintoneRecord[] = [];
  for (;;) {
    if (signal?.aborted) throw new AbortError();
    const res = await client.record.getRecordsByCursor({ id: cursorId });
    records.push(...(res.records as unknown as KintoneRecord[]));
    if (!res.next || records.length >= limit) break;
  }
  return records.slice(0, limit);
}

// Fetch every record matching `query` up to `limit`, using the cursor API in
// 500-record pages. Deletes the cursor on completion, abort, or truncation.
export async function fetchAllRecords(
  client: KintoneRestAPIClient,
  params: FetchParams,
): Promise<FetchResult> {
  const { app, query, limit, signal } = params;

  const create = () =>
    client.record.createCursor({ app, query, size: 500 }) as Promise<{
      id: string;
      totalCount: string;
    }>;

  let cursor = await create();
  const totalCount = Number(cursor.totalCount);

  try {
    let records: KintoneRecord[];
    try {
      records = await drainCursor(client, cursor.id, limit, signal);
    } catch (err) {
      if (err instanceof AbortError) throw err;
      // EC-11: retry once with a fresh cursor when the current one expired.
      if (isCursorExpired(err)) {
        cursor = await create();
        records = await drainCursor(client, cursor.id, limit, signal);
      } else {
        throw err;
      }
    }
    return { records, totalCount, truncated: totalCount > records.length };
  } finally {
    // Best-effort cleanup; ignore failures (cursor may already be gone).
    try {
      await client.record.deleteCursor({ id: cursor.id });
    } catch {
      /* cursor already deleted or expired */
    }
  }
}
