import { describe, expect, it } from "vitest";
import { stringifyField } from "../../src/core/formatter/stringify";
import type { FieldValue, FormatOptions, StringifyContext } from "../../src/core/types";

const baseFormat: FormatOptions = {
  dateTimeFormat: "YYYY-MM-DD HH:mm",
  thousandsSeparator: false,
  emptyValue: "",
};

function ctx(overrides: Partial<StringifyContext> = {}): StringifyContext {
  return {
    format: baseFormat,
    timeZone: "Asia/Tokyo",
    ...overrides,
  };
}

function fmt(overrides: Partial<FormatOptions>): FormatOptions {
  return { ...baseFormat, ...overrides };
}

describe("stringifyField", () => {
  it("TC-1: single line text unchanged", () => {
    expect(stringifyField({ type: "SINGLE_LINE_TEXT", value: "abc" }, ctx())).toBe("abc");
  });

  it("multi line text unchanged (newlines handled at escape stage)", () => {
    expect(stringifyField({ type: "MULTI_LINE_TEXT", value: "a\nb" }, ctx())).toBe("a\nb");
  });

  it("TC-8: number with and without thousands separator", () => {
    expect(
      stringifyField(
        { type: "NUMBER", value: "-123456.78" },
        ctx({ format: fmt({ thousandsSeparator: true }) }),
      ),
    ).toBe("-123,456.78");
    expect(stringifyField({ type: "NUMBER", value: "-123456.78" }, ctx())).toBe("-123456.78");
  });

  it("TC-9: calc format NUMBER uses number rule, DATETIME is raw", () => {
    expect(
      stringifyField(
        { type: "CALC", value: "1234" },
        ctx({ format: fmt({ thousandsSeparator: true }), calcFormat: "NUMBER" }),
      ),
    ).toBe("1,234");
    expect(
      stringifyField(
        { type: "CALC", value: "2026-06-30T23:30:00Z" },
        ctx({ calcFormat: "DATETIME" }),
      ),
    ).toBe("2026-06-30T23:30:00Z");
  });

  it("TC-10: date in both display formats", () => {
    expect(stringifyField({ type: "DATE", value: "2026-07-01" }, ctx())).toBe("2026-07-01");
    expect(
      stringifyField(
        { type: "DATE", value: "2026-07-01" },
        ctx({ format: fmt({ dateTimeFormat: "YYYY/MM/DD HH:mm" }) }),
      ),
    ).toBe("2026/07/01");
  });

  it("TC-11: time is passed through", () => {
    expect(stringifyField({ type: "TIME", value: "09:05" }, ctx())).toBe("09:05");
  });

  it("TC-12: datetime converts UTC to login timezone", () => {
    const field: FieldValue = { type: "DATETIME", value: "2026-06-30T23:30:00Z" };
    expect(stringifyField(field, ctx())).toBe("2026-07-01 08:30");
    expect(
      stringifyField(field, ctx({ format: fmt({ dateTimeFormat: "YYYY/MM/DD HH:mm" }) })),
    ).toBe("2026/07/01 08:30");
  });

  it("TC-13: dropdown and radio pass the selected value", () => {
    expect(stringifyField({ type: "DROP_DOWN", value: "受注" }, ctx())).toBe("受注");
    expect(stringifyField({ type: "RADIO_BUTTON", value: "A" }, ctx())).toBe("A");
  });

  it("TC-14: checkbox and multi-select join with comma", () => {
    expect(stringifyField({ type: "CHECK_BOX", value: ["A", "B"] }, ctx())).toBe("A, B");
    expect(stringifyField({ type: "MULTI_SELECT", value: ["X", "Y"] }, ctx())).toBe("X, Y");
  });

  it("TC-15: user / org / group selection joins names", () => {
    const value = [
      { code: "u1", name: "山田" },
      { code: "u2", name: "田中" },
    ];
    expect(stringifyField({ type: "USER_SELECT", value }, ctx())).toBe("山田, 田中");
    expect(stringifyField({ type: "ORGANIZATION_SELECT", value }, ctx())).toBe("山田, 田中");
    expect(stringifyField({ type: "GROUP_SELECT", value }, ctx())).toBe("山田, 田中");
  });

  it("TC-16: link value stays literal", () => {
    expect(stringifyField({ type: "LINK", value: "https://example.com" }, ctx())).toBe(
      "https://example.com",
    );
  });

  it("TC-17: attachment joins file names", () => {
    const value = [{ name: "a.pdf" }, { name: "b.png" }];
    expect(stringifyField({ type: "FILE", value }, ctx())).toBe("a.pdf, b.png");
  });

  it("TC-18: lookup resolves as its underlying type", () => {
    // A lookup backed by single-line text surfaces as SINGLE_LINE_TEXT.
    expect(stringifyField({ type: "SINGLE_LINE_TEXT", value: "CUST-1" }, ctx())).toBe("CUST-1");
    // A lookup backed by number obeys the number rule.
    expect(
      stringifyField(
        { type: "NUMBER", value: "1000" },
        ctx({ format: fmt({ thousandsSeparator: true }) }),
      ),
    ).toBe("1,000");
  });

  it("TC-19: record number, creator/modifier, created/updated time", () => {
    expect(stringifyField({ type: "RECORD_NUMBER", value: "REC-9" }, ctx())).toBe("REC-9");
    expect(
      stringifyField({ type: "CREATOR", value: { code: "u1", name: "作成 太郎" } }, ctx()),
    ).toBe("作成 太郎");
    expect(
      stringifyField({ type: "MODIFIER", value: { code: "u2", name: "更新 花子" } }, ctx()),
    ).toBe("更新 花子");
    expect(stringifyField({ type: "CREATED_TIME", value: "2026-06-30T23:30:00Z" }, ctx())).toBe(
      "2026-07-01 08:30",
    );
    expect(stringifyField({ type: "UPDATED_TIME", value: "2026-06-30T23:30:00Z" }, ctx())).toBe(
      "2026-07-01 08:30",
    );
  });

  it("TC-20: status, work assignee, category", () => {
    expect(stringifyField({ type: "STATUS", value: "進行中" }, ctx())).toBe("進行中");
    expect(
      stringifyField(
        {
          type: "STATUS_ASSIGNEE",
          value: [
            { code: "a", name: "担当A" },
            { code: "b", name: "担当B" },
          ],
        },
        ctx(),
      ),
    ).toBe("担当A, 担当B");
    expect(stringifyField({ type: "CATEGORY", value: ["営業", "重要"] }, ctx())).toBe("営業, 重要");
  });

  it("TC-21: subtable renders (N行) for the index cell", () => {
    const value = [
      { id: "1", value: {} },
      { id: "2", value: {} },
    ];
    expect(stringifyField({ type: "SUBTABLE", value }, ctx())).toBe("(2行)");
  });

  it("TC-22: empty values use the configured empty representation", () => {
    expect(stringifyField({ type: "SINGLE_LINE_TEXT", value: "" }, ctx())).toBe("");
    expect(
      stringifyField(
        { type: "SINGLE_LINE_TEXT", value: "" },
        ctx({ format: fmt({ emptyValue: "-" }) }),
      ),
    ).toBe("-");
    expect(
      stringifyField({ type: "USER_SELECT", value: [] }, ctx({ format: fmt({ emptyValue: "-" }) })),
    ).toBe("-");
    expect(
      stringifyField({ type: "NUMBER", value: null }, ctx({ format: fmt({ emptyValue: "-" }) })),
    ).toBe("-");
  });
});
