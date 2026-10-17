---
description: Fill in empty Burrowly connection fields (protocol, data format, timing, owner) from the software documentation
agent: agent
argument-hint: Optional, e.g. "only robot-cell.yaml" or "only the controller connections"
---

Fill in the empty fields of the Burrowly model in `model/`, using the software documentation
you have access to (connected docs tools, fetchable pages, or files in this workspace).

Follow `.github/skills/burrowly-model/SKILL.md`, sections 1, 3, 5 and 6:

1. Run `node tools/check.mjs` and take its list of empty connection fields as the to-do list.
   Limit it to this scope if one is given: ${input:scope:all levels}
2. For each connection, search the documentation for the interface between its two blocks.
3. Fill in only what a source states, add that source to the item's `links:`, and note anything
   you inferred in `notes:`. Leave a field empty when the docs do not answer it.
4. Run `node tools/check.mjs` again; it must report 0 errors.
5. Finish with a short summary: filled (with sources), not found, and inferred.
