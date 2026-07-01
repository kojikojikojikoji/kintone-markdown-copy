// Per-field-type stringification (FR-15). Produces the raw cell text before
// format-specific escaping (escape.ts) is applied. kintone-independent.

import type { FieldValue, StringifyContext } from "../types";
import { richTextToMarkdown } from "./richtext";

interface Entity {
  code?: string;
  name?: string;
}

interface FileItem {
  name?: string;
}

interface SubtableRow {
  id?: string;
  value?: Record<string, FieldValue>;
}

function isEmptyValue(value: any): boolean {
  if (value === "" || value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

// Insert thousands separators into a numeric string, keeping sign and decimals.
export function addThousandsSeparator(numStr: string): string {
  const negative = numStr.startsWith("-");
  const unsigned = negative ? numStr.slice(1) : numStr;
  const [intPart, fracPart] = unsigned.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fracPart !== undefined ? `.${fracPart}` : ""}`;
}

function formatNumber(value: string, thousands: boolean): string {
  if (value === "" || value === null || value === undefined) return "";
  return thousands ? addThousandsSeparator(String(value)) : String(value);
}

// Convert a UTC ISO datetime string to the login user's time zone.
export function formatDateTime(iso: string, timeZone: string, useSlash: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Some engines emit "24" for midnight under hour12:false; normalize to "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const dateStr = useSlash ? `${y}/${m}/${d}` : `${y}-${m}-${d}`;
  return `${dateStr} ${hour}:${get("minute")}`;
}

function entityNames(value: Entity[] | null | undefined): string {
  if (!Array.isArray(value)) return "";
  return value.map((e) => e?.name ?? "").join(", ");
}

function subtableRowCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

// Stringify a single field value into raw cell text (pre-escape).
// For SUBTABLE this returns the "(N行)" list-cell form (FR-14); the detail
// screen renders subtables separately and does not call this for them.
export function stringifyField(field: FieldValue, ctx: StringifyContext): string {
  const { format, timeZone } = ctx;
  const useSlash = format.dateTimeFormat === "YYYY/MM/DD HH:mm";
  const type = field.type;
  const value = field.value;

  if (type === "SUBTABLE") {
    return `(${subtableRowCount(value)}行)`;
  }

  if (isEmptyValue(value)) {
    return format.emptyValue;
  }

  switch (type) {
    case "SINGLE_LINE_TEXT":
    case "MULTI_LINE_TEXT":
    case "LINK":
    case "RECORD_NUMBER":
    case "STATUS":
    case "RADIO_BUTTON":
    case "DROP_DOWN":
      return String(value);

    case "RICH_TEXT":
      return richTextToMarkdown(String(value));

    case "NUMBER":
      return formatNumber(String(value), format.thousandsSeparator);

    case "CALC": {
      const calcFormat = ctx.calcFormat ?? "";
      if (calcFormat === "NUMBER" || calcFormat === "NUMBER_DIGIT") {
        return formatNumber(String(value), format.thousandsSeparator);
      }
      // Date/time and other calc formats: emit the API value unchanged.
      return String(value);
    }

    case "DATE":
      // "YYYY-MM-DD"; switch to slashes when the date-time option uses them.
      return useSlash ? String(value).replace(/-/g, "/") : String(value);

    case "TIME":
      return String(value);

    case "DATETIME":
    case "CREATED_TIME":
    case "UPDATED_TIME":
      return formatDateTime(String(value), timeZone, useSlash);

    case "CHECK_BOX":
    case "MULTI_SELECT":
    case "CATEGORY":
      return Array.isArray(value) ? value.join(", ") : String(value);

    case "USER_SELECT":
    case "ORGANIZATION_SELECT":
    case "GROUP_SELECT":
    case "STATUS_ASSIGNEE":
      return entityNames(value as Entity[]);

    case "CREATOR":
    case "MODIFIER":
      return (value as Entity)?.name ?? "";

    case "FILE":
      return Array.isArray(value) ? (value as FileItem[]).map((f) => f?.name ?? "").join(", ") : "";

    default:
      // Lookups surface as their underlying type (SINGLE_LINE_TEXT / NUMBER)
      // and are handled above. Anything unrecognized falls back to a string.
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
      return String(value);
  }
}

export type { SubtableRow };
