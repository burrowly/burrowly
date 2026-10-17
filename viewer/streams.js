// Data streams: resolve model/streams.yaml against the diagram levels.
// Shared by the viewer (viewer/index.html) and the command line (tools/check.mjs),
// so both report exactly the same problems.
//
// A stream is a list of blocks the data passes, in order. A block is named by its
// drill-down path: block ids from system.yaml down, joined by "/", for example
// "robot-cell/robot-pc". For every pair of neighbours we look for a connection
// on any level whose ends are those blocks, or blocks that contain them.
(function (root) {
  "use strict";
  const FILE = "streams.yaml";
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

  function normalizeStreams(d) {
    if (!isObj(d)) d = {};
    d.streams = Array.isArray(d.streams) ? d.streams.filter(isObj) : [];
    for (const s of d.streams) {
      if (s.id !== undefined) s.id = String(s.id);
      s.path = (Array.isArray(s.path) ? s.path : []).map(p => isObj(p) ? { ...p, block: p.block == null ? "" : String(p.block) } : { block: p == null ? "" : String(p) });
    }
    return d;
  }

  // "5 ms", "1.5s", "~200 µs", "2 min" -> milliseconds; null when it can't be read
  const UNIT = { ns: 1e-6, us: 1e-3, "µs": 1e-3, "μs": 1e-3, ms: 1, s: 1000, sec: 1000, min: 60000, h: 3600000 };
  function parseDuration(v) {
    if (v === undefined || v === null || v === "") return null;
    const m = String(v).trim().match(/^[~≈<>≤]?\s*(\d+(?:[.,]\d+)?)\s*(ns|us|µs|μs|ms|sec|s|min|h)$/i);
    return m ? parseFloat(m[1].replace(",", ".")) * UNIT[m[2].toLowerCase()] : null;
  }
  function fmtDuration(ms) {
    const r = (x) => String(Math.round(x * 100) / 100);
    if (ms === 0) return "0 ms";
    if (ms < 1) return r(ms * 1000) + " µs";
    if (ms < 1000) return r(ms) + " ms";
    if (ms < 60000) return r(ms / 1000) + " s";
    return r(ms / 60000) + " min";
  }

  function lev(a, b) {
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
    return d[b.length];
  }
  const closest = (id, ids) => { let best = null, bd = Infinity; for (const x of ids) { const k = lev(id, x); if (k < bd) { bd = k; best = x; } } return bd <= Math.max(2, id.length / 3) ? best : null; };

  // files: { name: { data, missing, error } }
  // Returns { streams: [{ id, name, raw, ok, steps, totalMs, unknown }], issues, carries, flow, canon, prefix }:
  // carries maps "file#connection-id" to the ids of the streams that ride it, flow to whether
  // each stream runs from -> to (true) or against it (false). with level data already normalised (blocks, external, connections, connection_types)
  function analyze(files, rootFile = "system.yaml") {
    const issues = [], add = (sev, msg, stream) => issues.push({ sev, file: FILE, msg, stream });
    const levels = Object.keys(files).filter(n => n !== FILE && files[n] && !files[n].missing && files[n].data);

    // drill-down structure
    const pm = {};
    for (const n of levels) for (const b of files[n].data.blocks) if (b.detail && !pm[b.detail]) pm[b.detail] = { file: n, block: b.id };
    const prefix = (file) => { const out = []; let cur = file; const seen = new Set();
      while (pm[cur] && !seen.has(cur)) { seen.add(cur); out.unshift(pm[cur].block); cur = pm[cur].file; }
      return cur === rootFile ? out : null; };
    const ancestors = (file) => { const out = []; let cur = file; const seen = new Set([file]);
      while (pm[cur] && !seen.has(pm[cur].file)) { cur = pm[cur].file; seen.add(cur); out.push(cur); } return out; };
    const resolveExt = (file, id) => {
      for (const a of ancestors(file)) {
        const d = files[a]?.data; if (!d) continue;
        if (d.blocks.some(x => x.id === id)) return a;
        if (d.external.some(x => String(x.id) === id)) { const r = resolveExt(a, id); if (r) return r; }
      }
      return null;
    };
    const pathCache = new Map();
    const canon = (file, id) => {   // drill-down path of a block or external on a level
      const k = file + "\n" + id; if (pathCache.has(k)) return pathCache.get(k);
      let home = files[file].data.blocks.some(b => b.id === id) ? file : files[file].data.external.some(e => String(e.id) === id) ? resolveExt(file, id) : null;
      const pre = home ? prefix(home) : null, p = pre ? [...pre, id].join("/") : null;
      pathCache.set(k, p); return p;
    };
    const within = (inner, outer) => inner === outer || inner.startsWith(outer + "/");
    const depth = (p) => p.split("/").length;

    // resolve "a/b/c" to a block
    function resolvePath(p) {
      const segs = p.split("/").map(s => s.trim()); let file = rootFile, block = null;
      for (let i = 0; i < segs.length; i++) {
        const d = files[file]?.data;
        if (!d || files[file].missing) return { err: `"${segs.slice(0, i).join("/")}" has no drill-down file yet, so "${p}" can't be found` };
        block = d.blocks.find(b => b.id === segs[i]);
        if (!block) {
          const near = closest(segs[i], d.blocks.map(b => b.id));
          const where = i ? `inside "${segs.slice(0, i).join("/")}"` : `on the top level`;
          return { err: `"${p}": there is no block "${segs[i]}" ${where}` + (near ? `. Did you mean "${[...segs.slice(0, i), near].join("/")}"?` : "") };
        }
        if (i < segs.length - 1) {
          if (!block.detail) return { err: `"${p}": "${segs.slice(0, i + 1).join("/")}" has no drill-down (no detail: file)` };
          file = block.detail;
        }
      }
      return { file, block, path: segs.join("/") };
    }

    // every connection on every level, with the drill-down paths of both ends
    const conns = [];
    for (const n of levels) {
      const d = files[n].data; if (files[n].error) continue;
      d.connections.forEach((c, i) => {
        const a = canon(n, c.from), b = canon(n, c.to);
        if (a && b && a !== b) conns.push({ file: n, idx: i, key: n + "#" + (c.id || "#" + (i + 1)), c, a, b });
      });
    }
    const typeOf = (file, t) => { for (const f of [file, ...ancestors(file)]) { const x = files[f]?.data?.connection_types?.[t]; if (x) return x; } return null; };
    const nameOf = (p) => { const r = resolvePath(p); return r.block?.name || p; };

    function hop(p, q, via) {
      const good = [], wrong = [];
      for (const x of conns) {
        for (const [from, to, fwd] of [[x.a, x.b, true], [x.b, x.a, false]]) {
          if (!within(p, from) || !within(q, to)) continue;
          if (within(from, to) || within(to, from)) continue;
          const dir = x.c.direction || "forward";
          const ok = dir === "both" || (fwd ? dir === "forward" : dir === "backward");
          (ok ? good : wrong).push({ ...x, fwd, score: depth(from) + depth(to), exactFrom: from === p, exactTo: to === q });
        }
      }
      let best;
      if (via) best = good.filter(g => g.c.id === via);
      else { const top = Math.max(-1, ...good.map(g => g.score)); best = good.filter(g => g.score === top); }
      // Coarser connections one or more levels up also carry the stream. When a level up has
      // several, `realizes:` on the inner connection says which one; otherwise all of them count.
      const min = Math.min(Infinity, ...best.map(g => g.score)), carried = [...best], loose = [];
      const coarse = good.filter(g => g.score < min && !best.includes(g)).sort((x, y) => y.score - x.score);
      const groups = new Map(); for (const g of coarse) { if (!groups.has(g.file)) groups.set(g.file, []); groups.get(g.file).push(g); }
      for (const [file, list] of groups) {
        const realized = new Set(carried.filter(g => g.c.realizes && pm[g.file]?.file === file).map(g => String(g.c.realizes)));
        const pick = list.filter(g => realized.has(g.c.id));
        carried.push(...(pick.length ? pick : list));
        if (!pick.length && list.length > 1) loose.push({ file, list });
      }
      return { good, wrong, best, carried, loose };
    }

    const sf = files[FILE];
    const result = { streams: [], issues, carries: new Map(), flow: new Map(), present: !!(sf && !sf.missing), prefix, canon, nameOf };
    if (!result.present) return result;
    if (sf.error) { add("err", "YAML error: " + sf.error); return result; }
    const data = sf.data || normalizeStreams({});

    const ids = new Set(), byId = new Map();
    for (const s of data.streams) if (s.id) byId.set(s.id, s);
    data.streams.forEach((s, si) => {
      const label = s.name || s.id || `#${si + 1}`, sid = s.id || `#${si + 1}`;
      const out = { id: sid, name: s.name || s.id || `Stream ${si + 1}`, raw: s, steps: [], ok: true, totalMs: 0, unknown: 0 };
      const err = (msg) => { out.ok = false; add("err", `Stream "${label}": ${msg}`, sid); };
      const warn = (msg) => add("warn", `Stream "${label}": ${msg}`, sid);
      if (!s.id) err("has no id");
      else if (ids.has(s.id)) err(`duplicate stream id "${s.id}"`);
      ids.add(s.id);
      if (s.path.length < 2) warn(s.path.length ? "has only one block in its path; list at least a source and a sink" : "has no path yet");

      for (const [i, e] of s.path.entries()) {
        const st = { i, ref: e.block, entry: e, path: e.block, ok: false, hop: null };
        if (!e.block) { err(`step ${i + 1} has no block`); out.steps.push(st); continue; }
        const r = resolvePath(e.block);
        if (r.err) err(r.err); else Object.assign(st, { ok: true, file: r.file, block: r.block, path: r.path, name: r.block.name || r.block.id });
        if (st.ok && r.block.detail && files[r.block.detail] && !files[r.block.detail].missing)
          warn(`passes "${st.name}" as a whole. It has a drill-down, so you can name the block inside it (${r.path}/...)`);
        st.duration = e.duration; st.ms = parseDuration(e.duration);
        if (e.duration !== undefined && e.duration !== "" && st.ms === null) warn(`step ${i + 1} duration "${e.duration}" can't be read; write a number and a unit, like "5 ms"`);
        if (st.ms !== null) out.totalMs += st.ms; else out.unknown++;
        const prev = out.steps[i - 1];
        if (e.via && i === 0) warn(`"via" on the first step is ignored; put it on the block the data arrives at`);
        if (prev?.ok && st.ok) {
          const a = prev.path, b = st.path, an = prev.name, bn = st.name;
          if (a === b) err(`"${bn}" is listed twice in a row`);
          else if (within(a, b) || within(b, a)) err(`"${within(a, b) ? an : bn}" is inside "${within(a, b) ? bn : an}"; list only the inner block`);
          else {
            const h = st.hop = hop(a, b, e.via ? String(e.via) : null);
            if (e.via && !h.best.length) err(`step ${i + 1} says via: ${e.via}, but that is not a connection from "${an}" to "${bn}"`);
            else if (!h.good.length) {
              if (h.wrong.length) err(`connection "${h.wrong[0].c.id || h.wrong[0].key}" between "${an}" and "${bn}" points the other way (direction: ${h.wrong[0].c.direction || "forward"})`);
              else err(`no connection from "${an}" to "${bn}" on any level`);
            } else {
              const perFile = new Map(); for (const g of h.best) perFile.set(g.file, (perFile.get(g.file) || 0) + 1);
              for (const [f, n] of perFile) if (n > 1 && !e.via)
                warn(`${n} connections join "${an}" and "${bn}" in ${f} (${h.best.filter(g => g.file === f).map(g => g.c.id || g.key).join(", ")}). Add via: <connection id> to step ${i + 1} to say which one`);
              if (!h.good.some(g => g.exactFrom) || !h.good.some(g => g.exactTo))
                warn(`"${an}" to "${bn}" is only drawn between the blocks around them (${h.best.map(g => g.c.id || g.key).join(", ")}). Draw it inside the drill-down too`);
              for (const g of h.best) if (g.c.type && typeOf(g.file, g.c.type)?.carries_data === false)
                warn(`rides "${g.c.id || g.key}", whose line type "${g.c.type}" is marked carries_data: false`);
              for (const { file, list } of h.loose)
                warn(`${list.length} connections join the blocks around "${an}" and "${bn}" in ${file} (${list.map(g => g.c.id || g.key).join(", ")}). Set realizes: on ${h.best.map(g => g.c.id || g.key).join(" / ")} to say which one carries it`);
              for (const g of h.carried) { if (!result.carries.has(g.key)) result.carries.set(g.key, []); const l = result.carries.get(g.key); if (!l.includes(sid)) l.push(sid);
                if (!result.flow.has(g.key)) result.flow.set(g.key, new Map()); result.flow.get(g.key).set(sid, g.fwd); }
            }
          }
        }
        out.steps.push(st);
      }
      result.streams.push(out);
    });

    // derived_from: must exist, and no loops
    for (const s of data.streams) {
      const df = s.derived_from === undefined ? [] : [].concat(s.derived_from).map(String);
      for (const x of df) if (!byId.has(x)) add("err", `Stream "${s.name || s.id}": derived_from "${x}" is not a stream`, s.id);
    }
    const parents = (id) => { const s = byId.get(id); return s ? [].concat(s.derived_from ?? []).map(String).filter(x => byId.has(x)) : []; };
    for (const id of byId.keys()) {
      const todo = parents(id), seen = new Set();
      while (todo.length) { const x = todo.pop(); if (x === id) { add("err", `Stream "${byId.get(id).name || id}" is derived from itself (derived_from loop)`, id); break; }
        if (!seen.has(x)) { seen.add(x); todo.push(...parents(x)); } }
    }

    for (const st of result.streams) if (issues.some(i => i.sev === "err" && i.stream === st.id)) st.ok = false;
    return result;
  }

  // Rewrite stream paths after a block is renamed: "a/old" and "a/old/..." become "a/new..."
  function renamedPath(p, oldPath, newPath) {
    return p === oldPath ? newPath : p.startsWith(oldPath + "/") ? newPath + p.slice(oldPath.length) : p;
  }

  const api = { FILE, normalizeStreams, analyze, parseDuration, fmtDuration, renamedPath };
  if (typeof module === "object" && module.exports) module.exports = api; else root.BurrowlyStreams = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
