// Stage the built assets into a contents directory and produce the plugin zip.
// Run after `npm run build`. Generates private.ppk on first run.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const build = join(root, "build");
const contents = join(build, "contents");

rmSync(build, { recursive: true, force: true });
mkdirSync(join(contents, "js"), { recursive: true });
mkdirSync(join(contents, "css"), { recursive: true });

// Root files referenced by the manifest.
cpSync(join(root, "plugin", "manifest.json"), join(contents, "manifest.json"));
cpSync(join(root, "plugin", "icon.png"), join(contents, "icon.png"));
cpSync(join(root, "src", "config", "config.html"), join(contents, "config.html"));

// Built JS.
for (const file of ["desktop.js", "mobile.js", "config.js"]) {
  cpSync(join(root, "dist", file), join(contents, "js", file));
}

// CSS delivered via the manifest.
cpSync(join(root, "src", "config", "theme.css"), join(contents, "css", "theme.css"));
cpSync(join(root, "src", "record.css"), join(contents, "css", "record.css"));
cpSync(join(root, "src", "config", "config.css"), join(contents, "css", "config.css"));

const ppk = join(root, "private.ppk");
const out = join(root, "kintone-markdown-copy.zip");
const bin = join(root, "node_modules", ".bin", "kintone-plugin-packer");

const args = [contents, "--out", out];
if (existsSync(ppk)) args.push("--ppk", ppk);

execFileSync(bin, args, { stdio: "inherit" });

// First run generates <pluginId>.ppk in the project root; keep it as
// private.ppk so the plugin id stays stable across builds.
if (!existsSync(ppk)) {
  const generated = readdirSync(root).find((f) => f.endsWith(".ppk") && f !== "private.ppk");
  if (generated) renameSync(join(root, generated), ppk);
}

// eslint-disable-next-line no-console
console.log(`Packed ${out}`);
