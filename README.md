# Burrowly

Architecture diagrams as code: dig from the whole system down into every subsystem.

Draw robotics software/hardware architecture as YAML files, view them as
clickable diagrams, and keep everything in git.

```
burrowly/               <- this repository
  model/                 <- your architecture, one YAML file per diagram level
    system.yaml          <- top level (start here)
    robot-cell.yaml      <- drill-down of a block (any block can have one)
  viewer/index.html      <- the viewer/editor (plain HTML, no build step)
  tools/serve.mjs        <- local server: view + edit + save back to model/
  tools/build.mjs        <- bundle everything into one shareable HTML file
  Dockerfile, compose.yaml  <- run it as a container
```

Requires only Node.js 18+. No npm install.

## Use it

```bash
node tools/serve.mjs          # open http://localhost:4321
```

- Click a block or a line to see its attributes, documentation links and connections.
- Blocks with a stacked shadow have subsystems: double-click them (or "open ▸") to drill down.
  The breadcrumb at the top takes you back up.
- **Edit** switches on editing, with no YAML needed:
  - Drag a chip from the bar above the diagram (Robot, Central, ...) onto the diagram to add a block.
    Click a chip to drop it in the first free spot.
  - Drag blocks to move them.
  - Hover a block and drag its **+** onto another block to connect them.
  - Click a block, a line, or empty space to edit it in the Details form: name, type, owner,
    protocol, data format, timing, documentation links and extra attributes.
  - The **Types** tab (or "Edit types…" next to the chips) adds, removes, renames, recolours and
    reorders block types (Robot, Central, ...) and line types. The chip order follows this list.
  - "Add subsystems" on a block creates its drill-down level, with the connected blocks already placed.
  - Changes save to the YAML files automatically (comments are kept), and **Undo** / Ctrl+Z reverts.
    Review with `git diff` and commit as usual. The YAML tab is still there for power users.
- **Line routing** is automatic: lines go around blocks (never behind them), use as few bends as possible, attach to
  the side of a block that faces the other end, and keep clear of each other. Corners are rounded. A dot marks the point
  where a bundled line splits. The old `route: L` hint is no longer needed (it is ignored).
- **Lines: Bundled / Separate** (above the diagram) switches between merged bus-style lines and one
  line per connection with its own attachment point on each block. Your choice is remembered in the browser.
  Lines of different types never share a path in either mode: they get their own attachment point and
  their own lane between rows. In Bundled mode only lines of the same type merge.
- **Edit YAML…** (next to the chips, or in the YAML tab) opens a large editor with line numbers,
  adjustable text size and line wrap. The diagram stays visible next to it and updates as you type;
  on a phone it fills the screen.
- **Zoom and pan**: use the **− / + / Fit** controls in the corner of the diagram, Ctrl/⌘ + scroll, or pinch on a
  trackpad or phone. Drag empty space to pan. Click the percentage to go back to 100%. Keyboard: `+`, `-`, `0` (fit).
  Each level remembers its own zoom while you click through.
- **Diagram size**: drag the bottom-right corner of the diagram area to make it taller or shorter.
  **⤢ Expand** (or `F`) fills the window with the diagram and keeps the Details panel next to it, so you can click through
  and drill down on a large chart. In this view, scrolling pans the diagram. Esc closes it.
- **Details panel size**: **⇥** (top right of the panel, or the `D` key) collapses it to a slim rail; click the rail to bring it back.
  Drag the panel's left edge to make it narrower or wider, and double-click that edge to reset. Both are remembered in the browser.
- **Upload** (top right, or drop files anywhere on the page) loads a `.yaml` file or a `.zip` of them, for example one
  made with **Export → YAML – all levels**. Files with the same name replace the current ones (you are asked first, and
  Undo brings them back); new names are added as new levels. Files that do not parse are skipped and listed.
- **Export ▾** (top right):
  - **PDF – all levels** gives one landscape page per diagram level, with its legend and interface table.
  - **PDF – this level** does the same for the level you are looking at.
  - **YAML – this level** downloads the .yaml file behind the current diagram (also the **Download** button in the large YAML editor).
  - **YAML – all levels (.zip)** downloads every model file in a `model/` folder, ready to drop into a repo or another install.
  - **PNG** and **SVG** export the current diagram as a 2× image or as a vector file. The SVG opens in draw.io, Inkscape, Visio and PowerPoint.

  The PDF export uses the browser's print dialog, so pick **Save as PDF** as the printer. Plain Ctrl+P / Cmd+P prints
  the current level the same way. Exports are always light-themed and show no selection or edit handles.
- **Checks** lists problems across all files: unknown ids, missing files, and connections that
  exist one level up but are not drawn in the drill-down.
- The interface table under the diagram shows which connections still miss
  `type / protocol / data_format / timing / owner` (configurable with
  `required_connection_fields` in `system.yaml`).

### Updating to a new version without losing your diagrams

Your diagrams live only in `model/`. This repository ignores `model/*.yaml` (see `.gitignore`),
so pulling a new version never touches your YAML files:

```bash
git pull
docker compose up -d --build --remove-orphans   # --remove-orphans stops a container from an older version
```

To version your diagrams, keep `model/` in its own repository, or remove the `model/` lines from `.gitignore`.

### Run it in Docker

```bash
docker compose up -d          # open http://localhost:4321
# Linux, so saved files keep your ownership:
UID=$(id -u) GID=$(id -g) docker compose up -d
```

`./model` is mounted into the container, so saving in the browser writes your
local YAML files and `git diff` shows the change, exactly like the Node setup.

Without compose:

```bash
docker build -t burrowly .
docker run --rm -p 4321:4321 -v "$PWD/model:/app/model" burrowly
```

Settings (environment variables):

| Variable    | Default      | Meaning                                                    |
|-------------|--------------|------------------------------------------------------------|
| `PORT`      | `4321`       | Port inside the container                                  |
| `MODEL_DIR` | `/app/model` | Where the YAML files are read from and saved to            |
| `READ_ONLY` | `0`          | `1` turns saving off, for a shared view-only server        |

For a shared team server, run with `READ_ONLY=1` and no volume (the model is baked
into the image at build time), and rebuild the image from CI on every merge to main.
The server has no login, so put it behind your VPN or reverse proxy.

The image also bundles the single-file export:

```bash
docker run --rm -v "$PWD/model:/app/model" -v "$PWD/dist:/app/dist" -u "$(id -u):$(id -g)" burrowly node tools/build.mjs
```

To share a read-only snapshot (wiki, email, CI artifact):

```bash
node tools/build.mjs          # -> dist/burrowly.html (single file)
```

`build.mjs` exits with an error if any YAML file does not parse, so you can run it in CI.

## The model

**Step-by-step guide:** [docs/YAML-GUIDE.md](docs/YAML-GUIDE.md) explains how to write the YAML from scratch, with a full field reference and common mistakes. Below is the short version.

One file is one diagram level. The order of sections matters for the editor's
"Add" buttons: header -> `kinds` -> `connection_types` -> `external` -> `blocks` -> `connections`.

```yaml
title: Plant system
links:                                   # documentation links, shown in the side panel
  - { title: Design wiki, url: https://... }
required_connection_fields: [type, protocol, data_format, timing, owner]

kinds:                                   # block categories (colour + corner badge)
  robot: { label: Robot, badge: R, color: green }
connection_types:                        # line categories
  realtime: { label: Robot / real-time link, color: orange }
  undefined: { label: Not yet defined, color: amber, dashed: true }

blocks:
  - id: robot-cell                    # unique on this level, used by connections
    name: Robot Cell
    subtitle: HR
    kind: robot
    at: [1, 1]                           # [column, row] on the grid; 1.5 etc. allowed
    owner: robot-team                    # any extra key is shown as an attribute
    detail: robot-cell.yaml           # makes the block drillable
    links: [{ title: HR hardware spec, url: https://... }]

connections:
  - id: cell-power
    from: robot-cell
    to: power-unit
    direction: both                      # forward | backward | both
    type: realtime
    protocol: CAN
    data_format: CANopen PDO
    timing: 5 ms
    owner: robot-team
    label: 5 ms                          # text on the line (default: protocol)
    notes: free text
    links: [{ title: ICD, url: https://... }]
    # any extra key (qos, topics, version, safety_level, ...) is shown too
```

Colours: `blue green purple gray orange amber teal red pink slate` or any CSS colour (`"#0a7"`).

### Drill-down files

A drill-down file uses the same format, plus:

```yaml
external:                       # blocks from the level above that connect in here
  - { id: ctl, at: [1, 0] }      # name/kind come from the parent file; drawn dashed
connections:
  - from: robot-pc
    to: ctl
    realizes: ctl-cell             # which connection one level up this one implements
```

`kinds` and `connection_types` are inherited from the levels above, so define the
common ones once in `system.yaml`. In edit mode, a block without subsystems shows
"Add subsystems to this block": it adds `detail:` and, when you open it, creates the
new file with the connected blocks already placed as externals.

## Working with git

- Every change is a small text diff, so reviews in pull requests work well.
- Give each subsystem its own file so teams can own and review their part
  (a CODEOWNERS entry per file works nicely).
- Comments in the YAML are kept when you edit through the viewer: it edits the text
  in place instead of regenerating the file.
