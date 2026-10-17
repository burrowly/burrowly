---
description: Turn notes, a list of systems and interfaces, or a spreadsheet into Burrowly diagram YAML
agent: agent
argument-hint: Paste your notes, or attach a file with #file
---

Turn the material I give you into Burrowly diagram levels in `model/`, following
`.github/skills/burrowly-model/SKILL.md`.

1. Read the existing model first (start at `model/system.yaml`) and run `node tools/check.mjs`.
   Extend what is there; do not start over, and reuse the existing ids, `kinds` and `connection_types`.
2. Map my material onto the model: systems become blocks on the right level, subsystems become a
   drill-down file (`detail:` + `external:` + `realizes:`), and interfaces become connections
   with type, protocol, data format, timing and owner where I gave them.
3. Where my material leaves something out and the software documentation you can reach answers it,
   fill it in with the source in `links:`. Otherwise leave it empty.
4. Lay blocks out on the grid so connected blocks are near each other and no two share a spot.
5. Run `node tools/check.mjs`; it must report 0 errors. Then list what you added and what is
   still empty.

My material:

${input:material:Paste notes here, or attach a file}
