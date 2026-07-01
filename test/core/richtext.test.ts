import { describe, expect, it } from "vitest";
import { richTextToMarkdown } from "../../src/core/formatter/richtext";

describe("richTextToMarkdown", () => {
  it("TC-3: inline strong / em / anchor", () => {
    expect(richTextToMarkdown('<strong>a</strong><em>b</em><a href="u">c</a>')).toBe(
      "**a***b*[c](u)",
    );
  });

  it("TC-3: anchor without href keeps text only", () => {
    expect(richTextToMarkdown("<a>label</a>")).toBe("label");
  });

  it("TC-4: nested unordered list indents two spaces", () => {
    expect(richTextToMarkdown("<ul><li>a<ul><li>b</li></ul></li></ul>")).toBe("- a\n  - b");
  });

  it("TC-4: ordered list numbers from one", () => {
    expect(richTextToMarkdown("<ol><li>x</li><li>y</li></ol>")).toBe("1. x\n2. y");
  });

  it("TC-5: paragraphs and br become newlines", () => {
    expect(richTextToMarkdown("<p>a</p><p>b</p>")).toBe("a\nb");
    expect(richTextToMarkdown("a<br>b")).toBe("a\nb");
  });

  it("TC-6: img alt handling", () => {
    expect(richTextToMarkdown('<img alt="図1">')).toBe("[画像: 図1]");
    expect(richTextToMarkdown("<img>")).toBe("[画像]");
  });

  it("TC-7: unsupported tags are stripped to their text", () => {
    expect(richTextToMarkdown("<table><tr><td>a</td></tr></table><h1>b</h1>")).toBe("ab");
  });

  it("decodes HTML entities", () => {
    expect(richTextToMarkdown("a &amp; b &lt;c&gt;")).toBe("a & b <c>");
  });
});
