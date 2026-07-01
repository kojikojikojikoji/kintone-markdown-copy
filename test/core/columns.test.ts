import { describe, expect, it } from "vitest";
import { resolveColumns } from "../../src/core/columns";
import type { FieldMeta } from "../../src/core/types";

function metas(...list: FieldMeta[]): Map<string, FieldMeta> {
  return new Map(list.map((m) => [m.code, m]));
}

describe("resolveColumns", () => {
  const a: FieldMeta = { code: "a", label: "A", type: "SINGLE_LINE_TEXT" };
  const b: FieldMeta = { code: "b", label: "B", type: "NUMBER" };
  const c: FieldMeta = { code: "c", label: "C", type: "DROP_DOWN" };

  it("TC-30: drops a form field missing from the record as permission-excluded", () => {
    const result = resolveColumns(["a", "b"], metas(a, b), new Set(["a"]));
    expect(result.columns).toEqual([a]);
    expect(result.permissionExcludedCount).toBe(1);
    expect(result.deletedCodes).toEqual([]);
  });

  it("keeps profile order and separates deleted fields", () => {
    const result = resolveColumns(["a", "gone", "c"], metas(a, c), new Set(["a", "c"]));
    expect(result.columns).toEqual([a, c]);
    expect(result.deletedCodes).toEqual(["gone"]);
    expect(result.permissionExcludedCount).toBe(0);
  });

  it("returns no columns when every field is excluded", () => {
    const result = resolveColumns(["a", "b"], metas(a, b), new Set());
    expect(result.columns).toEqual([]);
    expect(result.permissionExcludedCount).toBe(2);
  });
});
