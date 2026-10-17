# Burrowly: writing architecture diagrams in YAML

This guide shows how to build a diagram from scratch by writing the YAML yourself.
Everything here can also be done with the editor (Edit mode, forms, drag and drop).
The editor writes exactly this YAML, so you can mix both approaches.

- [1. How the files fit together](#1-how-the-files-fit-together)
- [2. Your first diagram in 5 minutes](#2-your-first-diagram-in-5-minutes)
- [3. Placing blocks on the grid](#3-placing-blocks-on-the-grid)
- [4. Block types and line types](#4-block-types-and-line-types)
- [5. Connections and their attributes](#5-connections-and-their-attributes)
- [6. Drilling down into subsystems](#6-drilling-down-into-subsystems)
- [7. Links to other documentation](#7-links-to-other-documentation)
- [8. Reference: every field](#8-reference-every-field)
- [9. Common mistakes](#9-common-mistakes)
- [10. Working with git](#10-working-with-git)
- [11. Data streams](#11-data-streams)

---

## 1. How the files fit together

```
model/
  system.yaml              <- the top level. The viewer always starts here.
  controller.yaml          <- what is inside the "Controller" block
  robot-cell.yaml          <- what is inside the "Robot Cell" block
```

- **One file is one diagram level.**
- A block with `detail: some-file.yaml` can be opened. That file is the level below.
- The top file must be called `system.yaml`.
- File names may only use letters, digits, `-`, `_` and `.`, and must end in `.yaml` or `.yml`.

Each file has the same sections, in this order:

```yaml
title: ...            # header fields (title, description, owner, links, ...)
kinds: ...            # block types       (optional)
connection_types: ... # line types        (optional)
external: ...         # blocks from the level above (drill-down files only)
blocks: ...           # the boxes
connections: ...      # the lines between them
```

---

## 2. Your first diagram in 5 minutes

Replace `model/system.yaml` with this and open the viewer:

```yaml
title: My robot cell

kinds:
  robot:   { label: Robot,   badge: R, color: green }
  control: { label: Control, badge: C, color: blue }

connection_types:
  network:  { label: Network,  color: slate }
  realtime: { label: Real-time, color: orange }

blocks:
  - id: plc
    name: Cell PLC
    kind: control
    at: [0, 0]

  - id: arm
    name: Robot Arm
    subtitle: 6 DoF
    kind: robot
    at: [1, 0]

  - id: camera
    name: Camera
    at: [1, 1]

connections:
  - id: plc-arm
    from: plc
    to: arm
    direction: both
    type: realtime
    protocol: EtherCAT
    timing: 1 ms cycle

  - id: camera-arm
    from: camera
    to: arm
    type: network
    protocol: GigE Vision
```

You get three blocks, two lines, a legend, and an interface table that shows which
fields are still empty.

Rules of thumb:

- `id` is the internal name. Use lowercase with dashes, and never reuse one on the same level.
  Connections refer to blocks by `id`.
- `name` is what is shown on the block.
- Indent with **spaces** (2 per level), never tabs.

---

## 3. Placing blocks on the grid

`at: [column, row]` puts a block on an invisible grid. `[0, 0]` is top left.

```
          column 0      column 1      column 2      column 3
row 0   [ Server ]    [ Controller ]               [ PLC ]
row 1   [ Sensors ]   [ Robot A ]     [ Robot B ]   [ HMI ]
row 2                       [ Power Unit ]             <- at: [1.5, 2]
```

- Half steps are allowed: `at: [1.5, 2]` centres a block between columns 1 and 2.
- Leave `at` out and the block is placed automatically below the others, with a
  warning in Checks. In Edit mode you can then drag it where you want it.
- Two blocks on the same spot gives a warning.

**How lines are drawn** is automatic. You only place the blocks:

- Lines go around blocks, never behind them, with as few bends as possible.
- A line leaves from the side of a block that faces the block on the other end. Blocks in the same row or column get a straight line.
- Lines of different types never share a path. Lines of the same type that start at the same block share their first part
  (the "bus" look), and a dot marks where they split.
- If a line takes a long way round, move a block so there is a clear gap between them.

Switch **Lines → Separate** above the diagram to draw every line on its own.

---

## 4. Block types and line types

### Block types (`kinds`)

```yaml
kinds:
  robot:   { label: Robot,           badge: R, color: green }
  local:   { label: Local equipment, badge: L, color: purple }
  other:   { label: Other systems,             color: gray }
```

- The key (`robot`) is what you write in a block's `kind:`.
- `label` shows in the legend and the add-chips.
- `badge` is the 1 to 3 characters in the circle on the block's corner (optional).
- `color` is one of `blue green purple gray orange amber teal red pink slate`, or any CSS
  colour such as `"#0a7f6f"` (quote it).
- The order here is the order of the chips in Edit mode.

### Line types (`connection_types`)

```yaml
connection_types:
  network:   { label: Network / messaging,    color: slate }
  realtime:  { label: Robot / real-time link, color: orange }
  power:     { label: Power,                  color: red, dashed: true }
```

`dashed: true` draws a dashed line.

### Where to define them

Types defined in `system.yaml` work on every level. A drill-down file can add its own
extra types (for example `sensor`, `actuator` inside a robot); those only exist on that
level and the levels below it.

---

## 5. Connections and their attributes

```yaml
connections:
  - id: ctl-cell                          # unique on this level
    from: ctl                           # block id
    to: robot-cell                  # block id
    direction: both                    # forward (default) | backward | both
    type: network                      # a key from connection_types
    protocol: MQTT / VDA 5050
    data_format: JSON (VDA 5050 v2.0 schema)
    timing: state >= 1 Hz, orders on event
    owner: control-team
    label: VDA 5050                    # text on the line (default: protocol)
    notes: Robots reconnect with a clean session.
    links:
      - { title: VDA 5050 spec, url: https://github.com/VDA5050/VDA5050 }

    # Anything else you add is shown in the details panel too:
    qos: 1
    topics: [order, instantActions, state]
    safety_level: none
```

### Required fields

`system.yaml` can say which fields every connection should have:

```yaml
required_connection_fields: [type, protocol, data_format, timing, owner]
```

Missing ones show as "not set" in the interface table and the progress bar, so you can
start rough and fill in over time. Nothing breaks when they are empty.

### Showing timing on the line

The text on the line is the `protocol` by default. To show something else:

```yaml
    timing: 5 ms
    label: 5 ms          # shows "5 ms" on the line
                         # (write label: "" to show no text at all)
```

---

## 6. Drilling down into subsystems

**Step 1.** Give the block a `detail:` file in the parent level:

```yaml
blocks:
  - id: robot-cell
    name: Robot Cell
    kind: robot
    at: [1, 1]
    detail: robot-cell.yaml
```

The block now has a stacked look and an "open ▸" link.

**Step 2.** Create `model/robot-cell.yaml`:

```yaml
title: Robot Cell

# Blocks from the level above that connect into this one.
# Only id and position; the name and type come from the parent file.
external:
  - { id: ctl,               at: [1, 0] }
  - { id: power-unit, at: [3, 2] }

kinds:                       # extra types for this level only (optional)
  compute: { label: Compute, badge: PC, color: blue }
  sensor:  { label: Sensor,  badge: S,  color: teal }

blocks:
  - id: robot-pc
    name: Robot PC
    kind: compute
    at: [1, 1]

  - id: bms
    name: Battery / BMS
    at: [2, 2]

connections:
  - id: pc-ctl
    from: robot-pc
    to: ctl
    direction: both
    protocol: MQTT / VDA 5050
    realizes: ctl-cell            # the connection one level up that this implements

  - id: bms-cs
    from: bms
    to: power-unit
    protocol: CAN
    timing: 5 ms
    realizes: cell-power
```

- `external` blocks are drawn with a dashed outline. They are how lines leave the subsystem.
- `realizes:` ties an inner connection to the outer one. The **Checks** tab warns when a
  connection exists one level up but is not drawn inside, so levels don't drift apart.
- Any block in a drill-down file can have its own `detail:`, so you can go as deep as you like
  (site → robot → computer → ROS 2 nodes).

Shortcut: in Edit mode, select the block and click **Add subsystems**. The file is created
for you with the connected blocks already placed as externals.

---

## 7. Links to other documentation

`links` works on a level, a block, and a connection:

```yaml
links:
  - title: Interface control document
    url: https://wiki.example.com/icd/controller-robot
  - title: Source code
    url: https://github.com/example/controller
  - { title: Jira epic, url: https://example.atlassian.net/browse/PRJ-12 }
```

Both the multi-line and the one-line `{ title, url }` forms work. Links open in a new tab.

---

## 8. Reference: every field

### Level (top of each file)

| Field                        | Required | Example                          | Meaning |
|------------------------------|----------|----------------------------------|---------|
| `title`                      | yes      | `Plant system`            | Name in the breadcrumb and header |
| `description`                |          | `Top-level view of the site.`    | Shown in the side panel |
| `owner`                      |          | `control-team`                     | Who maintains this level |
| `status`                     |          | `draft`, `example`, `approved`   | Shown as a tag |
| `links`                      |          | see section 7                    | Documentation links |
| `required_connection_fields` |          | `[type, protocol, owner]`        | Only read from `system.yaml` |
| `kinds`                      |          | see section 4                    | Block types |
| `connection_types`           |          | see section 4                    | Line types |
| `external`                   |          | `- { id: ctl, at: [1, 0] }`       | Drill-down files only |
| `blocks`                     | yes      | list                             | The boxes |
| `connections`                |          | list                             | The lines |

### Block

| Field         | Required | Example                 | Meaning |
|---------------|----------|-------------------------|---------|
| `id`          | yes      | `robot-cell`         | Unique on this level; used by connections |
| `name`        | yes      | `Robot Cell`         | Text on the block |
| `subtitle`    |          | `HR`                    | Small text under the name |
| `kind`        |          | `robot`                 | A key from `kinds` |
| `at`          |          | `[1, 1]`                | Grid position `[column, row]` |
| `detail`      |          | `robot-cell.yaml`    | Makes the block open into that file |
| `owner`       |          | `robot-team`            | |
| `description` |          | `Picks and places...`   | |
| `links`       |          | see section 7           | |
| anything else |          | `hardware: IPC, 32 GB`  | Shown in the details panel |

### Connection

| Field         | Required | Example                 | Meaning |
|---------------|----------|-------------------------|---------|
| `id`          | yes*     | `ctl-cell`                 | Unique on this level. *Needed to edit it in the forms |
| `from`, `to`  | yes      | `ctl`, `robot-cell`   | Block ids on this level (blocks or externals) |
| `direction`   |          | `both`                  | `forward` (default), `backward`, `both` |
| `type`        |          | `network`               | A key from `connection_types` |
| `protocol`    |          | `EtherCAT`              | Also the default text on the line |
| `data_format` |          | `Protobuf`              | |
| `timing`      |          | `1 ms cycle`            | Free text |
| `owner`       |          | `controls-team`         | |
| `label`       |          | `5 ms`                  | Text on the line; `""` for none |
| `realizes`    |          | `ctl-cell`                 | Connection one level up that this implements |
| `notes`       |          | free text               | |
| `links`       |          | see section 7           | |
| anything else |          | `qos: 1`                | Shown in the details panel |

---

## 9. Common mistakes

| You see                                        | Cause and fix |
|------------------------------------------------|---------------|
| "YAML error: bad indentation" with a line number | A line is indented one space too many or too few. Every level is 2 spaces. Use **Go to error** in the large editor. |
| "YAML error" after pasting                      | Tabs were pasted. Replace them with spaces. |
| `"to: xyz" is not a block on this level`        | Typo in an id, or the block lives on another level. In a drill-down, add it under `external:`. |
| A block uses unknown kind                        | The `kind:` value is not a key under `kinds`. Check spelling or add the type. |
| Text with `:` or `#` looks cut off              | Put it in quotes: `notes: "Port 1883: TLS off # for now"` |
| Colour like `#0a7` does nothing                 | Quote it: `color: "#0a7"`. Without quotes `#` starts a comment. |
| A badge `!` gives an error                      | Quote it: `badge: "!"` |
| "connects to this block one level up but is not drawn here" | Add the missing external and connection in the drill-down, or ignore it while sketching. |
| Stream: "there is no block ... Did you mean ...?" | A block in a stream path was renamed or removed. Fix the path in `streams.yaml`; the suggestion is the closest existing id. |
| Stream: "no connection from A to B on any level" | The path skips a block, or the connection is missing. Add the block in between, or draw the connection. |

---

## 10. Working with git

- Each level is a small text file, so `git diff` shows exactly what changed, and pull
  requests can be reviewed like code.
- Comments (`# ...`) are kept when you edit through the viewer.
- Give each team its own drill-down file and use a `CODEOWNERS` entry per file
  (for example `model/robot-cell.yaml @robot-team`).
- `node tools/build.mjs` fails when a file does not parse, so you can run it in CI to
  block broken YAML from merging, and publish `dist/burrowly.html` as a read-only snapshot.
- `node tools/check.mjs` runs the Checks tab from the command line and fails on errors. It also
  lists which connection fields are still empty.
- GitHub Copilot can write and fill in these files for you; see "Using GitHub Copilot" in the README.

---

## 11. Data streams

A connection says *how* two blocks are linked. A **data stream** says *what travels* and
*where it goes*: for example images from a camera, through the cell PLC, to the vision
application on the robot PC. One stream usually crosses several connections and often
several levels.

Streams live in one optional file, `model/streams.yaml`:

```yaml
streams:
  - id: depth-images
    name: Depth images
    owner: vision-team
    data: depth image 640x480, 16 bit       # extra fields are shown in the Streams tab
    rate: 30 fps
    path:
      - { block: robot-cell/depth-camera, duration: 4 ms }
      - { block: robot-cell/cell-plc,     duration: 2 ms }
      - { block: robot-cell/robot-pc/vision-app, duration: 35 ms, note: grasp point search }

  - id: grasp-points
    name: Grasp points
    derived_from: depth-images             # made from the depth images
    path: [robot-cell/robot-pc/vision-app, robot-cell/cell-plc, robot-cell/gripper]
```

### The path

- `path` lists the blocks the data passes, **in the order it flows**: source first, receiver last.
- A block is named by its **drill-down path**: the block ids from `system.yaml` down, joined by `/`.
  `controller` is a block on the top level; `robot-cell/cell-plc` is the block `cell-plc` inside
  the drill-down of `robot-cell`. File names don't matter, so renaming a `.yaml` file breaks nothing.
- You don't list connections. For each pair of neighbours, Burrowly finds the connection between
  them, on whichever level it is drawn. Leaving a level works through `external:` blocks as usual.
- A step can be a plain path (`robot-cell/gripper`) or an object with more fields:

| Field      | Meaning |
|------------|---------|
| `block`    | The drill-down path (required) |
| `duration` | How long this step takes: for the first block, producing the data; for the others, getting the data there and handling it. A number and a unit: `ns`, `us`/`µs`, `ms`, `s`, `min`, `h` (`5 ms`, `1.5 s`, `~200 µs`). |
| `via`      | The connection id to use when two blocks have more than one connection between them |
| `note`     | Free text shown under the step |

- The path can start rough and get detailed later. `path: [controller, robot-cell]` is a valid
  stream; Checks then suggests naming the block inside `robot-cell` once its drill-down exists.
- One source with several receivers: write one stream per receiver. Each stream stays a simple line.
- A block that appears in several places (say two robot PCs that each run the same application)
  is a separate block per place, so each stream names the one it uses.

### Stream fields

| Field          | Meaning |
|----------------|---------|
| `id`           | Unique id (required) |
| `name`         | Shown in the Streams tab |
| `description`  | Free text |
| `owner`        | Who is responsible for the data |
| `derived_from` | Id (or list of ids) of the streams this one is computed from |
| `color`        | Highlight colour, same values as block colours (optional; a colour is picked otherwise) |
| `links`        | Documentation links, as in section 7 |
| anything else  | `rate`, `data`, `retention`, ... shown in the Streams tab |

### In the viewer

- **Streams** tab: every stream with its total duration. Click one to see its steps: each block,
  the protocol / data format / timing of the connection in between, each step's duration and the
  total. Steps without a duration are counted, so you see what is missing.
- While a stream is open, the diagram shows its route: numbered blocks, a moving line in the flow
  direction, and "continues inside" on a block whose drill-down the stream passes through. The
  highlight follows you when you open other levels.
- The details of a block list the streams through it; the details of a line list the streams it carries.
- In Edit mode, renaming a block also updates every stream path that uses it, and deleting a block
  or line that a stream uses asks again and says how many streams use it.

### What Checks catch

Errors (also from `node tools/check.mjs`, which then exits non-zero):

- a step names a block that doesn't exist (with the closest id as a suggestion)
- two neighbours have no connection between them on any level
- the connection exists but points the other way (`direction`)
- `via` names a connection that doesn't join those two blocks
- `derived_from` names an unknown stream, or streams derive from each other in a loop
- duplicate stream ids, the same block twice in a row, or a block followed by a block inside it
  (list only the inner one)

Checks to review:

- two blocks have more than one connection and no `via` says which one
- a step is only connected through the blocks around it (drawn one level up, not in the drill-down)
- one level up has several connections and the inner one has no `realizes:` saying which one it implements
- the stream rides a line type marked `carries_data: false` (for example
  `power: { label: Power, color: red, dashed: true, carries_data: false }`)
- a step passes a block with a drill-down as a whole
- a duration that can't be read, or a stream with fewer than two blocks

