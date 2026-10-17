---
description: Rules for editing Burrowly diagram files (model YAML)
applyTo: "model/**/*.{yaml,yml}"
---

These files are Burrowly diagram levels. Follow `.github/skills/burrowly-model/SKILL.md`
and the field reference in `docs/YAML-GUIDE.md`, section 8.

- Edit in place. Keep comments, key order and section order; 2-space indent, no tabs.
- Do not rename existing ids. New ids are lowercase with dashes and unique on their level.
- `from` / `to` must be a block or an `external:` id on the same level.
- Only fill in values you found in a source, and add that source to `links:`.
- Quote values that contain `:` or `#`, and colours such as `"#0a7f6f"`.
- Run `node tools/check.mjs` after editing and fix every error.
