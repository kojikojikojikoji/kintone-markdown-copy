// Rebuild plugin/icon.png from plugin/icon.svg (56x56).
// Prefers rsvg-convert, then sips (macOS). Run with `npm run icon`.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const svg = join(root, "plugin", "icon.svg");
const png = join(root, "plugin", "icon.png");

function has(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!existsSync(svg)) {
  throw new Error("plugin/icon.svg not found");
}

if (has("rsvg-convert")) {
  execFileSync("rsvg-convert", ["-w", "56", "-h", "56", svg, "-o", png], { stdio: "inherit" });
} else if (has("sips")) {
  execFileSync("sips", ["-s", "format", "png", "-z", "56", "56", svg, "--out", png], {
    stdio: "inherit",
  });
} else {
  throw new Error("No SVG converter found. Install librsvg (rsvg-convert) or use macOS sips.");
}

// eslint-disable-next-line no-console
console.log(`Wrote ${png}`);
