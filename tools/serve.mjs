#!/usr/bin/env node
// Local viewer + editor. No dependencies.
//   node tools/serve.mjs            -> http://localhost:4321
//   node tools/serve.mjs --port 8080 --model path/to/model
// Environment variables (used by the Docker image):
//   HOST (default 127.0.0.1), PORT (4321), MODEL_DIR (./model), READ_ONLY=1 (disable saving)
// Edits made in the browser are written straight into the model/*.yaml files,
// so `git diff` shows exactly what changed.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const port = Number(arg("--port", process.env.PORT || 4321));
const host = arg("--host", process.env.HOST || "127.0.0.1");
const modelDir = resolve(arg("--model", process.env.MODEL_DIR || join(here, "..", "model")));
const readOnly = args.includes("--read-only") || /^(1|true|yes)$/i.test(process.env.READ_ONLY || "");
const viewerDir = resolve(join(here, "..", "viewer"));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".yaml": "text/yaml; charset=utf-8", ".yml": "text/yaml; charset=utf-8", ".css": "text/css" };
const safeName = (n) => /^[\w.-]+\.ya?ml$/.test(n) && !n.startsWith(".");

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);
  const send = (code, body, type = "text/plain; charset=utf-8") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
  try {
    if (path === "/api/ping") return send(200, JSON.stringify({ ok: true, canSave: !readOnly }), "application/json");
    if (path.startsWith("/model/")) {
      const name = path.slice("/model/".length);
      if (!safeName(name)) return send(400, "Bad file name");
      const file = join(modelDir, name);
      if (req.method === "PUT") {
        if (readOnly) return send(403, "This server is read-only");
        let body = ""; for await (const chunk of req) body += chunk;
        await writeFile(file, body);
        console.log(`saved model/${name}`);
        return send(200, "saved");
      }
      // streams.yaml is optional: answer "nothing there" without an error in the browser console
      if (name === "streams.yaml") { try { return send(200, await readFile(file), types[".yaml"]); } catch (e) { if (e.code === "ENOENT") return send(204, ""); throw e; } }
      return send(200, await readFile(file), types[extname(name)]);
    }
    if (path === "/" || path === "/index.html") return send(200, await readFile(join(viewerDir, "index.html")), types[".html"]);
    if (path === "/streams.js") return send(200, await readFile(join(viewerDir, "streams.js")), types[".js"]);
    if (path.startsWith("/vendor/") && !path.includes("..")) return send(200, await readFile(join(viewerDir, path)), types[extname(path)] || "application/octet-stream");
    send(404, "Not found");
  } catch (e) {
    send(e.code === "ENOENT" ? 404 : 500, e.code === "ENOENT" ? "Not found" : String(e));
  }
}).listen(port, host, () => {
  console.log(`Burrowly: http://localhost:${port}  (listening on ${host})`);
  console.log(`Model folder:        ${modelDir}${readOnly ? "  [read-only]" : ""}`);
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
