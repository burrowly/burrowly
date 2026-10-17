#!/usr/bin/env node
// Bundle the viewer and every model/*.yaml into ONE html file you can share,
// attach to a wiki page or publish from CI.
//   node tools/build.mjs                 -> dist/burrowly.html
//   node tools/build.mjs --fragment out  -> body-only variant (for hosts that add their own <html>)
// Also exits non-zero if a YAML file does not parse, so it works as a CI check.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const args = process.argv.slice(2);
const fragIdx = args.indexOf("--fragment");
const out = fragIdx >= 0 ? args[fragIdx + 1] : join(root, "dist", "burrowly.html");

const files = {};
for (const name of (await readdir(join(root, "model"))).sort()) {
  if (/\.ya?ml$/.test(name)) files[name] = await readFile(join(root, "model", name), "utf8");
}
// parse check with the same library the viewer uses
const jsyamlSrc = await readFile(join(root, "viewer", "vendor", "js-yaml.min.js"), "utf8");
const mod = { exports: {} }; new Function("module", "exports", jsyamlSrc)(mod, mod.exports);
let bad = 0;
for (const [name, text] of Object.entries(files)) {
  try { mod.exports.load(text); } catch (e) { bad++; console.error(`${name}: ${e.message.split("\n")[0]}`); }
}
if (bad) process.exit(1);

let html = await readFile(join(root, "viewer", "index.html"), "utf8");
const bundle = JSON.stringify(files).replace(/</g, "\\u003c");
html = html.replace('<script src="vendor/js-yaml.min.js"></script>',
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js"></script>\n' +
  `<script id="model-bundle" type="application/json">${bundle}</script>`);
if (fragIdx >= 0) html = html.replace(/<!doctype html>\s*/i, "").replace(/<\/?(html|head|body)[^>]*>\s*/gi, "");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, html);
console.log(`Wrote ${out} (${Object.keys(files).length} model files)`);
