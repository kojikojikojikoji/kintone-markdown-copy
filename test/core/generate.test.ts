import { describe, expect, it } from "vitest";
import { generateDetail, generateIndex } from "../../src/core/formatter/generate";
import type { FieldMeta, FormatOptions, KintoneRecord } from "../../src/core/types";

const format: FormatOptions = {
  dateTimeFormat: "YYYY-MM-DD HH:mm",
  thousandsSeparator: false,
  emptyValue: "",
};
const opts = { format, timeZone: "Asia/Tokyo" };

const company: FieldMeta = { code: "company", label: "会社名", type: "SINGLE_LINE_TEXT" };
const status: FieldMeta = { code: "status", label: "商談ステータス", type: "DROP_DOWN" };
const amount: FieldMeta = { code: "amount", label: "受注金額", type: "NUMBER" };

describe("generateDetail", () => {
  it("TC-25: builds the vertical markdown table", () => {
    const record: KintoneRecord = {
      company: { type: "SINGLE_LINE_TEXT", value: "サイボウズ株式会社" },
      status: { type: "DROP_DOWN", value: "受注" },
      amount: { type: "NUMBER", value: "1000000" },
    };
    const result = generateDetail(record, [company, status, amount], "table", opts);
    expect(result).toEqual({
      ok: true,
      rowCount: 3,
      text: [
        "| フィールド | 値 |",
        "| --- | --- |",
        "| 会社名 | サイボウズ株式会社 |",
        "| 商談ステータス | 受注 |",
        "| 受注金額 | 1000000 |",
      ].join("\n"),
    });
  });

  it("TC-26: builds the bullet list with a continuation line", () => {
    const name: FieldMeta = { code: "name", label: "名前", type: "SINGLE_LINE_TEXT" };
    const memo: FieldMeta = { code: "memo", label: "メモ", type: "MULTI_LINE_TEXT" };
    const record: KintoneRecord = {
      name: { type: "SINGLE_LINE_TEXT", value: "太郎" },
      memo: { type: "MULTI_LINE_TEXT", value: "a\nb" },
    };
    const result = generateDetail(record, [name, memo], "list", opts);
    expect(result.ok && result.text).toBe("- 名前: 太郎\n- メモ: a\n  b");
  });

  it("TC-32: returns a no-columns error when nothing can be output", () => {
    expect(generateDetail({}, [], "table", opts)).toEqual({ ok: false, reason: "no-columns" });
  });

  describe("TC-21: subtable in the three detail formats", () => {
    const name: FieldMeta = { code: "name", label: "名前", type: "SINGLE_LINE_TEXT" };
    const items: FieldMeta = {
      code: "items",
      label: "明細",
      type: "SUBTABLE",
      subFields: [
        { code: "item", label: "品目", type: "SINGLE_LINE_TEXT" },
        { code: "qty", label: "数量", type: "NUMBER" },
      ],
    };
    const record: KintoneRecord = {
      name: { type: "SINGLE_LINE_TEXT", value: "太郎" },
      items: {
        type: "SUBTABLE",
        value: [
          {
            id: "1",
            value: {
              item: { type: "SINGLE_LINE_TEXT", value: "りんご" },
              qty: { type: "NUMBER", value: "3" },
            },
          },
          {
            id: "2",
            value: {
              item: { type: "SINGLE_LINE_TEXT", value: "みかん" },
              qty: { type: "NUMBER", value: "5" },
            },
          },
        ],
      },
    };

    it("table", () => {
      const result = generateDetail(record, [name, items], "table", opts);
      expect(result.ok && result.text).toBe(
        [
          "| フィールド | 値 |",
          "| --- | --- |",
          "| 名前 | 太郎 |",
          "",
          "明細",
          "| 品目 | 数量 |",
          "| --- | --- |",
          "| りんご | 3 |",
          "| みかん | 5 |",
        ].join("\n"),
      );
    });

    it("list", () => {
      const result = generateDetail(record, [name, items], "list", opts);
      expect(result.ok && result.text).toBe(
        [
          "- 名前: 太郎",
          "",
          "- 明細:",
          "  - 品目: りんご, 数量: 3",
          "  - 品目: みかん, 数量: 5",
        ].join("\n"),
      );
    });

    it("tsv", () => {
      const result = generateDetail(record, [name, items], "tsv", opts);
      expect(result.ok && result.text).toBe(
        ["名前\t太郎", "", "明細", "品目\t数量", "りんご\t3", "みかん\t5"].join("\n"),
      );
    });

    it("counts only body fields as rows", () => {
      const result = generateDetail(record, [name, items], "table", opts);
      expect(result.ok && result.rowCount).toBe(1);
    });

    it("EC-19: empty subtable prints (0行)", () => {
      const empty: KintoneRecord = {
        name: { type: "SINGLE_LINE_TEXT", value: "太郎" },
        items: { type: "SUBTABLE", value: [] },
      };
      const result = generateDetail(empty, [name, items], "table", opts);
      expect(result.ok && result.text).toBe(
        ["| フィールド | 値 |", "| --- | --- |", "| 名前 | 太郎 |", "", "明細", "(0行)"].join("\n"),
      );
    });
  });
});

describe("generateIndex", () => {
  const records: KintoneRecord[] = [
    {
      company: { type: "SINGLE_LINE_TEXT", value: "A社" },
      status: { type: "DROP_DOWN", value: "受注" },
    },
    {
      company: { type: "SINGLE_LINE_TEXT", value: "B社" },
      status: { type: "DROP_DOWN", value: "提案中" },
    },
  ];

  it("TC-27: horizontal markdown table keeps profile column order", () => {
    const result = generateIndex(records, [company, status], "table", opts);
    expect(result).toEqual({
      ok: true,
      rowCount: 2,
      text: [
        "| 会社名 | 商談ステータス |",
        "| --- | --- |",
        "| A社 | 受注 |",
        "| B社 | 提案中 |",
      ].join("\n"),
    });
  });

  it("TC-27: tsv keeps profile column order", () => {
    const result = generateIndex(records, [company, status], "tsv", opts);
    expect(result.ok && result.text).toBe("会社名\t商談ステータス\nA社\t受注\nB社\t提案中");
  });

  it("FR-14: bullet list nests non-first fields under the first field value", () => {
    const result = generateIndex(records.slice(0, 1), [company, status], "list", opts);
    expect(result.ok && result.text).toBe("- A社\n  - 商談ステータス: 受注");
  });

  it("FR-14: subtable column shows (N行) in the index", () => {
    const items: FieldMeta = { code: "items", label: "明細", type: "SUBTABLE" };
    const rec: KintoneRecord[] = [
      {
        company: { type: "SINGLE_LINE_TEXT", value: "A社" },
        items: {
          type: "SUBTABLE",
          value: [
            { id: "1", value: {} },
            { id: "2", value: {} },
            { id: "3", value: {} },
          ],
        },
      },
    ];
    const result = generateIndex(rec, [company, items], "table", opts);
    expect(result.ok && result.text).toBe(
      ["| 会社名 | 明細 |", "| --- | --- |", "| A社 | (3行) |"].join("\n"),
    );
  });

  it("TC-32: no-columns error", () => {
    expect(generateIndex(records, [], "tsv", opts)).toEqual({ ok: false, reason: "no-columns" });
  });
});
