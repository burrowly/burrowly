---
name: burrowly-model
description: Read, extend and fill in Burrowly architecture diagrams (model/*.yaml) from the user's notes and software documentation. Use when asked to add blocks, connections or drill-down levels, or to fill in protocol, data format, timing or owner from docs.
---

# Working on a Burrowly model

Burrowly turns YAML files into clickable, drill-down architecture diagrams. You help the user by
turning what they give you (their own notes, a rough model, and the software documentation you can
reach) into correct YAML, and by filling in connection details that are still empty.

The full field reference is `docs/YAML-GUIDE.md` (section 8). This skill is the short version plus
the rules for working from documentation.

## 1. Read the model first

1. Start at `model/system.yaml` and follow every block's `detail:` to the file below it.
   Only files reached this way are shown in the viewer.
2. Run `node tools/check.mjs`. It prints errors, checks (warnings) and, per connection, which
   required fields are still empty. That list is your to-do list when the user says "fill it in".
3. Note which `kinds` (block types) and `connection_types` (line types) exist. Reuse them; only add
   a new one when nothing fits, and tell the user.

## 2. The format

```yaml
title: Robot Cell                     # header: title (required), description, owner, status, links
required_connection_fields: [type, protocol, data_format, timing, owner]   # system.yaml only

kinds:                                # block types; inherited by every level below
  control: { label: Control, badge: C, color: blue }
connection_types:                     # line types; inherited by every level below
  network:  { label: Network, color: slate }
  power:    { label: Power, color: red, dashed: true }

external:                             # drill-down files only: blocks from the level above
  - { id: controller, at: [0, 0] }    # only id + position; name and kind come from above

blocks:
  - id: cell-plc                      # required, unique on this level, lowercase-with-dashes
    name: Cell PLC                    # required, shown on the block
    subtitle: S7-1500                 # optional
    kind: control                     # a key from kinds
    at: [1, 0]                        # [column, row]; half steps like 1.5 allowed
    detail: cell-plc.yaml             # optional: makes the block open into that file
    owner: controls-team
    description: Runs the cell sequence.
    links:
      - { title: PLC manual, url: https://docs.example.com/plc }
    # any other key (hardware, version, ...) is shown in the details panel

connections:
  - id: controller-plc                # unique on this level
    from: controller                  # a block or external id on THIS level
    to: cell-plc
    direction: both                   # forward (default) | backward | both
    type: network                     # a key from connection_types
    protocol: OPC UA
    data_format: OPC UA binary, companion spec v1.02
    timing: 100 ms subscription       # free text
    owner: controls-team
    label: OPC UA                     # text on the line; default is protocol; "" for none
    realizes: controller-cell         # drill-down only: the connection one level up this implements
    notes: Certificates are rotated yearly.
    links:
      - { title: Interface spec, url: https://docs.example.com/icd/opcua }
```

Colours: `blue green purple gray orange amber teal red pink slate`, or a quoted CSS colour (`"#0a7f6f"`).

## 3. Filling in details from documentation

The user may connect you to their software documentation (an MCP server, a docs site you can fetch,
or files in the workspace). Use it like this:

1. **Pick the gaps.** Take the empty fields from `node tools/check.mjs`, or the blocks and
   connections the user named. By default, fill only empty fields. Change a value that is already
   there only when the user asks, or when a source clearly contradicts it; then say so.
2. **Search per connection.** Look up the interface between the two ends: interface control
   documents, API specs, message definitions, config files, READMEs. Good search terms are both
   block names, the protocol, and topic, endpoint or message names.
3. **Only write what a source says.** For every value you add:
   - add the page or file you took it from to that connection's (or block's) `links:`,
     with a title that says what it is;
   - if you had to combine or interpret sources, add a short `notes:` line saying what you
     inferred, for example `notes: "timing inferred from the 10 Hz publish rate in the node config"`.
   If the docs do not answer it, leave the field empty. An empty field shows as "not set" in the
   viewer, which is honest; a guessed value looks finished and is not.
4. **Use the user's words.** Owners are team names from the docs or the user, not people you
   guess. Protocol names are written the way the docs write them, with a version when the docs give one.
5. **Extra facts go in extra keys.** QoS, topics, ports, versions, safety levels and the like go
   in their own keys on the connection (`qos: 1`, `topics: [state, order]`, `port: 4840`).

## 4. Adding blocks, connections and levels

- New ids: lowercase with dashes, unique on their level. Connection ids are usually `from-to`.
- Give every new block an `at:` that is not taken on that level. Put blocks that talk to each
  other in the same row or column where you can; lines are routed automatically.
- A connection can only join blocks on the same level. To reach a block from a higher level
  inside a drill-down, list it under `external:` with its id and a position.
- To open a block into a new level: add `detail: <file>.yaml` to the block, create that file with
  a `title`, an `external:` entry for every block it connects to one level up, the inner `blocks`,
  and inner `connections` with `realizes:` pointing at the outer connection ids.
- File names: letters, digits, `-`, `_`, `.`; ending in `.yaml`.
- Data streams (data that travels through several blocks) go in `model/streams.yaml`, not in the
  level files. A stream's `path` lists blocks by drill-down path (`robot-cell/cell-plc`), in the
  order the data flows. Only add a stream, step or `duration` that a document states. See section 11
  of `docs/YAML-GUIDE.md`. `streams.yaml` is a reserved name: never use it for a drill-down level.

## 5. Editing rules

- Edit the text in place. Keep comments, blank lines, key order and the section order
  (header, `kinds`, `connection_types`, `external`, `blocks`, `connections`).
  The viewer edits the same way, so a `git diff` stays small and readable.
- 2 spaces per indent level, never tabs. Both `- { title, url }` and the multi-line form are fine;
  follow what the file already uses.
- Quote any value containing `: ` or ` #`, values starting with a special character
  (`"!"`, `"*"`, `"@"`), and hex colours.
- Never rename or delete an existing `id` unless the user asks: other levels refer to it through
  `external:`, `realizes:` and stream paths in `streams.yaml`. If you must, update every reference
  and run the checks.

## 6. Check your work

1. Run `node tools/check.mjs`. It must report **0 errors**. Fix the checks you caused; leave
   pre-existing ones alone unless asked, and mention them.
2. Tell the user in a few lines: which fields you filled and from which sources, which you could
   not find, and anything you inferred.
3. To look at the result, the user runs `node tools/serve.mjs` (or `docker compose up -d`) and
   opens http://localhost:4321. The viewer reloads the files when the page is refreshed.

## 7. Keep the user's model private

`model/*.yaml` is git-ignored on purpose: it is the user's own architecture, and this repository
only ships the tool. Never `git add -f` model files, and never copy their content into the README,
the guide, examples or code.
