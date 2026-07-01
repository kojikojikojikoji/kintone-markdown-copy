import { describe, expect, it } from "vitest";
import { escapeListValue, escapeTableCell, escapeTsvCell } from "../../src/core/formatter/escape";

describe("escape", () => {
  it("TC-2: table cell turns newline into <br>", () => {
    expect(escapeTableCell("a\nb")).toBe("a<br>b");
  });

  it("TC-23: table cell escapes pipes", () => {
    expect(escapeTableCell("A|B")).toBe("A\\|B");
  });

  it("TC-2/TC-23: table cell escapes pipe and newline together", () => {
    expect(escapeTableCell("A|B\nC")).toBe("A\\|B<br>C");
  });

  it("list value uses a continuation line for newlines", () => {
    expect(escapeListValue("line1\nline2")).toBe("line1\n  line2");
  });

  it("list value keeps pipes literal", () => {
    expect(escapeListValue("A|B")).toBe("A|B");
  });

  it("TC-24: tsv cell replaces tabs and newlines with a single space", () => {
    expect(escapeTsvCell("a\tb\nc")).toBe("a b c");
  });

  it("normalizes CRLF before applying rules", () => {
    expect(escapeTableCell("a\r\nb")).toBe("a<br>b");
    expect(escapeTsvCell("a\r\nb")).toBe("a b");
  });
});
