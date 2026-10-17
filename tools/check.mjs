#!/usr/bin/env node
// Run the viewer's Checks from the command line (levels and model/streams.yaml),
// plus a list of connection fields that are still empty and a summary of the streams. Handy in CI and for AI assistants editing the YAML.
//   node tools/check.mjs                      -> checks ./model
//   node tools/check.mjs --model path/to/model
//   node tools/check.mjs --quiet              -> errors and checks only, no empty-field list
// Exits non-zero when there are errors (warnings alone pass).
import { readFile, readdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const modelDir = resolve(arg("--model", process.env.MODEL_DIR || join(here, "..", "model")));
const quiet = args.includes("--quiet");
const ROOT = "system.yaml";
const CORE_CONN_FIELDS = ["type", "protocol", "data_format", "timing", "owner"];

const jsyamlSrc = await readFile(join(here, "..", "viewer", "vendor", "js-yaml.min.js"), "utf8");
const mod = { exports: {} }; new Function("module", "exports", jsyamlSrc)(mod, mod.exports);
const jsyaml = mod.exports;
const smod = { exports: {} }; new Function("module", "exports", await readFile(join(here, "..", "viewer", "streams.js"), "utf8"))(smod, smod.exports);
const Streams = smod.exports;

// same normalisation and helpers as viewer/index.html
const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
const validAt = (a) => Array.isArray(a) && a.length >= 2 && a.every(x => typeof x === "number" && isFinite(x));
function normalize(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
  const asArr = (v) => Array.isArray(v) ? v.filter(x => x && typeof x === "object") : [];
  d.blocks = asArr(d.blocks);
  d.connections = asArr(d.connections);
  d.external = asArr(d.external).map(e => typeof e === "string" ? { id: e } : e);
  d.kinds = (d.kinds && typeof d.kinds === "object") ? d.kinds : {};
  d.connection_types = (d.connection_types && typeof d.connection_types === "object") ? d.connection_types : {};
  for (const b of d.blocks) if (b.id !== undefined) b.id = String(b.id);
  for (const c of d.connections) { if (c.from !== undefined) c.from = String(c.from); if (c.to !== undefined) c.to = String(c.to); }
  return d;
}

// load like the viewer: start at system.yaml and follow every `detail:`
const files = {};
const queue = [ROOT];
while (queue.length) {
  const name = queue.shift(); if (files[name]) continue;
  let text;
  try { text = await readFile(join(modelDir, name), "utf8"); }
  catch { files[name] = { missing: true, data: normalize({}) }; continue; }
  const f = files[name] = { text };
  try { f.data = normalize(jsyaml.load(text)); }
  catch (e) { f.error = e.message.split("\n")[0]; f.data = normalize({}); }
  for (const b of f.data.blocks) if (b.detail) queue.push(b.detail);
}
if (files[ROOT].missing) { console.error(`No ${ROOT} in ${modelDir}`); process.exit(1); }
// model/streams.yaml (optional): data streams across the levels, see viewer/streams.js
try {
  const text = await readFile(join(modelDir, Streams.FILE), "utf8");
  try { files[Streams.FILE] = { text, data: Streams.normalizeStreams(jsyaml.load(text)), streams: true }; }
  catch (e) { files[Streams.FILE] = { text, error: e.message.split("\n")[0], data: Streams.normalizeStreams({}), streams: true }; }
} catch {}
const levelFiles = Object.entries(files).filter(([, f]) => !f.streams);

const parentMap = () => {
  const m = {};
  for (const [name, f] of levelFiles) for (const b of f.data.blocks) if (b.detail && !m[b.detail]) m[b.detail] = { file: name, block: b.id };
  return m;
};
const pm = parentMap();
function ancestors(file) {
  const out = []; let cur = file; const seen = new Set([file]);
  while (pm[cur] && !seen.has(pm[cur].file)) { cur = pm[cur].file; seen.add(cur); out.push(cur); }
  return out;
}
function kindsFor(file) {
  const k = {}, t = {};
  for (const f of [file, ...ancestors(file)].reverse()) { Object.assign(k, files[f]?.data.kinds); Object.assign(t, files[f]?.data.connection_types); }
  return { kinds: k, types: t };
}
function resolveExternal(file, id) {
  for (const a of ancestors(file)) {
    const d = files[a]?.data; if (!d) continue;
    const b = d.blocks.find(x => x.id === id); if (b) return b;
    if (d.external.find(x => String(x.id) === id)) { const r = resolveExternal(a, id); if (r) return r; }
  }
  return null;
}

// the checks, kept in step with checks() in viewer/index.html
const out = [];
const add = (sev, file, msg) => out.push({ sev, file, msg });
for (const [name, f] of levelFiles) {
  if (f.missing) continue;
  if (f.error) { add("err", name, "YAML error: " + f.error); continue; }
  const d = f.data, { kinds, types } = kindsFor(name);
  const ids = new Map();
  for (const b of d.blocks) {
    if (!b.id) { add("err", name, `Block "${b.name || "?"}" has no id`); continue; }
    if (ids.has(b.id)) add("err", name, `Duplicate id "${b.id}"`);
    ids.set(b.id, b);
    if (!b.name) add("warn", name, `Block "${b.id}" has no name`);
    if (b.kind && !kinds[b.kind]) add("warn", name, `Block "${b.id}" uses unknown kind "${b.kind}"`);
    if (!validAt(b.at)) add("warn", name, `Block "${b.id}" has no position (at: [col, row]); placed automatically`);
    if (b.detail && files[b.detail]?.missing) add("warn", name, `"${b.id}" points to ${b.detail}, which does not exist yet`);
  }
  for (const e of d.external) {
    const id = String(e.id);
    if (ids.has(id)) add("err", name, `"${id}" is both a block and an external`);
    ids.set(id, e);
    if (!pm[name]) add("warn", name, `External "${id}" listed, but no block opens this file`);
    else if (!resolveExternal(name, id)) add("err", name, `External "${id}" not found on any level above`);
  }
  const pos = new Map();
  for (const n of [...d.blocks, ...d.external]) if (validAt(n.at)) {
    const k = n.at.join(","); if (pos.has(k)) add("warn", name, `"${n.id}" and "${pos.get(k)}" are at the same position`);
    pos.set(k, n.id);
  }
  const cids = new Set();
  d.connections.forEach((c, i) => {
    const cid = c.id || `#${i + 1}`;
    if (c.id && cids.has(c.id)) add("err", name, `Duplicate connection id "${c.id}"`);
    cids.add(c.id);
    if (!ids.has(c.from)) add("err", name, `Connection ${cid}: "from: ${c.from}" is not a block on this level`);
    if (!ids.has(c.to)) add("err", name, `Connection ${cid}: "to: ${c.to}" is not a block on this level`);
    if (c.type && !types[c.type]) add("warn", name, `Connection ${cid} uses unknown type "${c.type}"`);
    if (c.realizes && pm[name] && !files[pm[name].file].data.connections.find(x => x.id === c.realizes))
      add("err", name, `Connection ${cid} realizes "${c.realizes}", which is not a connection one level up`);
  });
  if (pm[name]) {
    const { file: pf, block: pb } = pm[name];
    for (const pc of files[pf].data.connections) {
      if (pc.from !== pb && pc.to !== pb) continue;
      const other = pc.from === pb ? pc.to : pc.from;
      const ok = d.connections.some(c => c.realizes === pc.id) || d.connections.some(c => c.from === other || c.to === other);
      if (!ok) add("warn", name, `"${pc.id || other}" (${files[pf].data.blocks.find(b => b.id === other)?.name || other}) connects to this block one level up but is not drawn here`);
    }
  }
}

const streamResult = Streams.analyze(files, ROOT);
for (const i of streamResult.issues) add(i.sev, i.file, i.msg);

// YAML files in model/ that no `detail:` reaches are never shown by the viewer
try {
  for (const n of (await readdir(modelDir)).sort())
    if (/\.ya?ml$/.test(n) && !files[n] && n !== Streams.FILE) add("warn", n, `Not reachable from ${ROOT}: no block has "detail: ${n}", so the viewer never loads it`);
} catch {}

const errs = out.filter(i => i.sev === "err"), warns = out.filter(i => i.sev === "warn");
for (const i of [...errs, ...warns]) console.log(`${i.sev === "err" ? "error" : "check"}  ${i.file}: ${i.msg}`);

if (!quiet) {
  const required = files[ROOT].data.required_connection_fields || CORE_CONN_FIELDS;
  let total = 0, filled = 0; const todo = [];
  for (const [name, f] of levelFiles) for (const [i, c] of f.data.connections.entries()) {
    const miss = required.filter(k => isEmpty(c[k]));
    total += required.length; filled += required.length - miss.length;
    if (miss.length) todo.push(`  ${name}  ${c.id || `#${i + 1}`} (${c.from} -> ${c.to}): ${miss.join(", ")}`);
  }
  if (todo.length) console.log(`\nEmpty connection fields (${filled}/${total} filled):\n${todo.join("\n")}`);
  else if (total) console.log(`\nAll required connection fields filled (${total}).`);
  if (streamResult.streams.length) {
    console.log(`\nStreams (${streamResult.streams.length}):`);
    for (const st of streamResult.streams) {
      const t = st.steps.length - st.unknown ? Streams.fmtDuration(st.totalMs) + (st.unknown ? ` + ${st.unknown} step${st.unknown > 1 ? "s" : ""} without duration` : "") : "no durations";
      console.log(`  ${st.ok ? "ok " : "ERR"} ${st.id}: ${st.steps.map(x => x.path || "?").join(" -> ")}  [${t}]`);
    }
  }
}

console.log(`\n${Object.values(files).filter(f => !f.missing).length} files, ${errs.length} error${errs.length === 1 ? "" : "s"}, ${warns.length} check${warns.length === 1 ? "" : "s"}`);
process.exit(errs.length ? 1 : 0);
