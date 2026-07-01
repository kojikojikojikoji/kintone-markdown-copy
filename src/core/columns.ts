// Resolve which profile fields become output columns for a record set (FR-18).
// Pure: takes form-field metadata and the set of field codes actually present
// in the record data (absent codes mean the viewer lacks read access).

import type { FieldMeta } from "./types";

export interface ColumnResolution {
  // Output columns in profile order (present in form and readable).
  columns: FieldMeta[];
  // Fields that exist in the form but are missing from the record (permission).
  permissionExcludedCount: number;
  // Field codes that are not in the form definition at all (deleted).
  deletedCodes: string[];
}

export function resolveColumns(
  fieldCodes: string[],
  formMetas: Map<string, FieldMeta>,
  availableCodes: Set<string>,
): ColumnResolution {
  const columns: FieldMeta[] = [];
  const deletedCodes: string[] = [];
  let permissionExcludedCount = 0;

  for (const code of fieldCodes) {
    const meta = formMetas.get(code);
    if (!meta) {
      deletedCodes.push(code);
      continue;
    }
    if (!availableCodes.has(code)) {
      permissionExcludedCount += 1;
      continue;
    }
    columns.push(meta);
  }

  return { columns, permissionExcludedCount, deletedCodes };
}
