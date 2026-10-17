# Burrowly: instructions for GitHub Copilot

Burrowly draws architecture diagrams from YAML. One YAML file in `model/` is one diagram level.
`model/system.yaml` is the top level, and a block with `detail: other.yaml` drills down into that file.

- `viewer/index.html` is the whole viewer and editor (plain HTML and JavaScript, no build step, no npm dependencies).
- `tools/serve.mjs` serves it on http://localhost:4321 and saves edits back to `model/`.
- `tools/check.mjs` runs the same checks as the viewer's Checks tab and lists empty connection fields.
- `tools/build.mjs` bundles everything into one HTML file.
- `docs/YAML-GUIDE.md` is the full YAML reference. Read it before writing model files.

## When you work on the model (`model/*.yaml`)

Use the `burrowly-model` skill in `.github/skills/burrowly-model/SKILL.md`. In short:

- Edit the YAML text in place. Keep comments, key order and the section order
  (header, `kinds`, `connection_types`, `external`, `blocks`, `connections`). Indent with 2 spaces.
- Never rename an existing `id`: connections, `external:` entries, `realizes:` and the stream paths
  in `model/streams.yaml` refer to it.
- Never invent values. Every protocol, data format, timing or owner you fill in must come from a
  source you actually read, and that source goes in the item's `links:`.
- After every change run `node tools/check.mjs` and fix all errors.
- `model/*.yaml` is git-ignored on purpose: it holds the user's own architecture. Never `git add -f` it,
  and never copy model content into the README, docs or code.

## When you work on the tool itself

- Keep it dependency-free: Node 18+ built-ins only, and the vendored `viewer/vendor/js-yaml.min.js`.
- The viewer writes YAML by editing text, not by re-serialising, so comments survive. Keep it that way.
- If you change the checks in `viewer/index.html` (`function checks()`), make the same change in `tools/check.mjs`.
- Data stream logic lives only in `viewer/streams.js`, which both the viewer and `tools/check.mjs` load. Change it there.
- Examples in docs and code stay generic (Controller, Robot Cell, Power Unit). No real project names.
