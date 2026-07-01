// Rich-text (HTML) to Markdown conversion (FR-15 rich editor row).
// Parsing uses DOMParser (never innerHTML), per common spec section 6.

type ParseHtml = (html: string) => Document;

const defaultParse: ParseHtml = (html) => new DOMParser().parseFromString(html, "text/html");

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function isList(el: Element): boolean {
  return el.tagName === "UL" || el.tagName === "OL";
}

function renderList(node: Element, depth: number): string {
  const ordered = node.tagName === "OL";
  const items = Array.from(node.children).filter((c) => c.tagName === "LI");
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  items.forEach((li, i) => {
    const marker = ordered ? `${i + 1}.` : "-";
    let inline = "";
    let nested = "";
    li.childNodes.forEach((child) => {
      if (child.nodeType === ELEMENT_NODE && isList(child as Element)) {
        nested += `\n${renderList(child as Element, depth + 1)}`;
      } else {
        inline += walk(child);
      }
    });
    lines.push(`${indent}${marker} ${inline.trim()}${nested}`);
  });
  return lines.join("\n");
}

function walk(node: Node): string {
  if (node.nodeType === TEXT_NODE) {
    // textContent is already entity-decoded by the parser.
    return node.textContent ?? "";
  }
  if (node.nodeType !== ELEMENT_NODE) {
    return "";
  }
  const el = node as Element;
  const children = () => Array.from(el.childNodes).map(walk).join("");
  switch (el.tagName) {
    case "BR":
      return "\n";
    case "STRONG":
    case "B":
      return `**${children()}**`;
    case "EM":
    case "I":
      return `*${children()}*`;
    case "A": {
      const href = el.getAttribute("href");
      const text = children();
      return href ? `[${text}](${href})` : text;
    }
    case "IMG": {
      const alt = el.getAttribute("alt");
      return alt ? `[画像: ${alt}]` : "[画像]";
    }
    case "UL":
    case "OL":
      return renderList(el, 0);
    case "P":
    case "DIV":
      // Block element: keep content on its own line.
      return `${children()}\n`;
    default:
      // Unsupported tags (table, h1-h6, span, ...): drop the tag, keep text.
      return children();
  }
}

// Convert a kintone rich-text HTML string to Markdown.
export function richTextToMarkdown(html: string, parseHtml: ParseHtml = defaultParse): string {
  if (!html) return "";
  const doc = parseHtml(html);
  const body = doc.body;
  let out = "";
  body.childNodes.forEach((n) => {
    out += walk(n);
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
