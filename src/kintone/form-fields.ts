import type { KintoneRestAPIClient } from "@kintone/rest-api-client";
import type { FieldMeta } from "../core/types";

// Field types that carry a value and can be selected for output (spec section 3).
export const OUTPUT_FIELD_TYPES: ReadonlySet<string> = new Set([
  "SINGLE_LINE_TEXT",
  "MULTI_LINE_TEXT",
  "RICH_TEXT",
  "NUMBER",
  "CALC",
  "DATE",
  "TIME",
  "DATETIME",
  "DROP_DOWN",
  "RADIO_BUTTON",
  "CHECK_BOX",
  "MULTI_SELECT",
  "USER_SELECT",
  "ORGANIZATION_SELECT",
  "GROUP_SELECT",
  "LINK",
  "FILE",
  "RECORD_NUMBER",
  "CREATOR",
  "MODIFIER",
  "CREATED_TIME",
  "UPDATED_TIME",
  "STATUS",
  "STATUS_ASSIGNEE",
  "CATEGORY",
  "SUBTABLE",
]);

// Types that never hold a value and are excluded from selection.
const NON_VALUE_TYPES: ReadonlySet<string> = new Set([
  "LABEL",
  "SPACER",
  "HR",
  "REFERENCE_TABLE",
  "GROUP",
]);

interface RawField {
  type: string;
  code: string;
  label: string;
  format?: string;
  fields?: Record<string, RawField>;
}

function toMeta(field: RawField): FieldMeta {
  const meta: FieldMeta = { code: field.code, label: field.label, type: field.type };
  if (field.type === "CALC" && field.format) {
    meta.calcFormat = field.format;
  }
  if (field.type === "SUBTABLE" && field.fields) {
    // TODO(spec FR-7): inner column order follows the properties object order,
    // not the form layout. Use /k/v1/app/form/layout if strict order matters.
    meta.subFields = Object.values(field.fields)
      .filter((f) => !NON_VALUE_TYPES.has(f.type))
      .map((f) => ({ code: f.code, label: f.label, type: f.type, calcFormat: f.format }));
  }
  return meta;
}

// Build a code -> FieldMeta map from the form definition. Used both for output
// labels/metadata (runtime) and for the selectable field list (config).
export async function fetchFieldMetas(
  client: KintoneRestAPIClient,
  app: number,
  preview = false,
): Promise<Map<string, FieldMeta>> {
  const res = await client.app.getFormFields({ app, preview });
  const properties = res.properties as unknown as Record<string, RawField>;
  const map = new Map<string, FieldMeta>();
  for (const field of Object.values(properties)) {
    if (NON_VALUE_TYPES.has(field.type)) continue;
    map.set(field.code, toMeta(field));
  }
  return map;
}
