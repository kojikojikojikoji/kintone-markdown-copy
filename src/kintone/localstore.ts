import type { OutputFormat } from "../core/types";

// Last selection persistence (FR-24). Low-sensitivity display state only.
// Key: kp-mdcopy-<domain>-<appId>-<userCode> (common spec section 6).

export interface LastSelection {
  profileId: string;
  format: OutputFormat;
}

export function selectionKey(appId: number, userCode: string): string {
  const domain = location.hostname;
  return `kp-mdcopy-${domain}-${appId}-${userCode}`;
}

export function loadSelection(key: string): LastSelection | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastSelection>;
    if (
      typeof parsed.profileId === "string" &&
      (parsed.format === "table" || parsed.format === "list" || parsed.format === "tsv")
    ) {
      return { profileId: parsed.profileId, format: parsed.format };
    }
  } catch {
    /* ignore malformed or unavailable storage */
  }
  return null;
}

export function saveSelection(key: string, selection: LastSelection): void {
  try {
    localStorage.setItem(key, JSON.stringify(selection));
  } catch {
    /* storage may be full or blocked; last-selection is non-critical */
  }
}
