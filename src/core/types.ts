// Shared domain types. kintone-independent.

export type OutputFormat = "table" | "list" | "tsv";
export type TargetScreen = "detail" | "index" | "both";
export type DateTimeFormat = "YYYY-MM-DD HH:mm" | "YYYY/MM/DD HH:mm";
export type EmptyValue = "" | "-";

export interface FormatOptions {
  dateTimeFormat: DateTimeFormat;
  thousandsSeparator: boolean;
  emptyValue: EmptyValue;
}

export interface Profile {
  id: string;
  name: string;
  target: TargetScreen;
  fieldCodes: string[];
  format: FormatOptions;
}

export interface PluginSettings {
  defaultProfileId: string;
  maxRecords: number;
  profiles: Profile[];
}

export interface PluginConfig {
  version: 1;
  settings: PluginSettings;
}

// A field value as it appears inside a kintone record.
export interface FieldValue {
  type: string;
  value: any;
}

// Form field metadata needed for stringification that the record value
// alone does not carry (labels, calc format, subtable inner fields).
export interface FieldMeta {
  code: string;
  label: string;
  type: string;
  // Present for CALC fields: "NUMBER" | "NUMBER_DIGIT" | "DATETIME" | "DATE" | "TIME" | ...
  calcFormat?: string;
  // Present for SUBTABLE fields: inner field metas in form-definition order.
  subFields?: FieldMeta[];
}

// Options passed to the per-field stringifier.
export interface StringifyContext {
  format: FormatOptions;
  timeZone: string;
  calcFormat?: string;
}

// A record shaped like kintone's record objects: { fieldCode: { type, value } }.
export type KintoneRecord = Record<string, FieldValue>;

// Result of resolving which columns to output for a given record set.
export interface ResolvedColumns {
  // Metas for fields that will be output, in profile order.
  columns: FieldMeta[];
  // Number of profile fields dropped because the viewer lacks read access.
  permissionExcludedCount: number;
}
