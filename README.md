# IVI Tactical Board

A browser-based volleyball tactics board focused on **half-court team-side visualization** for coaching sessions.

This project is currently optimized for:

- fast rotation walkthroughs (`R1` to `R6`)
- serving/receive/defense positioning views
- clean presentation to players (including full-screen presentation mode)
- on-court drawing tools for tactical explanation

---

## 1. Current Product Scope

The app is a **single-page frontend tool** (no backend required) with:

- one main canvas (`<canvas id="C">`)
- tactical state managed in `script.js`
- UI/branding and theme styles in `styles.css`

Current tactical emphasis is on **5-1 rotation templates** with tuned layouts for all rotations:

- serving positions (`R1..R6`)
- receive positions (`R1..R6`)

`4-2` and `6-2` options are present in the selector and still use generic model logic where specific templates are not customized yet.

---

## 2. Project Structure

```txt
Tactics board/
  index.html        # UI markup
  styles.css        # theme + layout + presentation mode styles
  script.js         # tactical engine, rendering, interactions
  logo.png          # brand/logo used in header + court watermark
  tests/
    engine.test.js  # deterministic engine tests (requires Node)
```

---

## 3. How To Run

No installation is required.

1. Open `index.html` in a browser.
2. Use controls in the top bar + side panel.

Optional local static server examples:

- VS Code Live Server
- `python -m http.server` (if Python is installed)

---

## 4. Main UI Controls

### Top-right system selector

- `5-1`
- `4-2`
- `6-2`

### Toolbar (top row)

- `Select` (drag players/ball)
- `Arrow` (draw directional arrows)
- `Curve` (draw curved path with double-click end)
- `Draw` (freehand drawing)
- `Undo` / `Redo`
- `Clear` (clear drawings)
- `Reset` (reset tactical state)
- `Ball` (toggle ball object)
- `Zone #` (toggle court/player zone number display)
- `Present` (presentation mode toggle)

### Left panel

- Rotation:
  - `Prev`, `Next`, and direct `R1..R6` buttons
- Situation:
  - `SERVING`, `RECEIVE`, `DEFENSE`
- Defense scenario selector:
  - `vs Zone 4`, `vs Zone 3`, `vs Zone 2`, `vs Pipe`
- Color + line width settings for drawings

### Context menu

Right-click a player for:

- set number
- change role
- remove player

---

## 5. Keyboard Shortcuts

- `Ctrl + Z` => Undo
- `Ctrl + Y` => Redo
- `Ctrl + Shift + Z` => Redo
- `P` => Toggle Presentation Mode
- `Esc` => Exit Presentation Mode

---

## 6. Presentation Mode

Presentation Mode is designed for live team explanation.

When enabled:

- top bar is hidden
- toolbar is hidden
- side panel is hidden
- status bar is hidden
- canvas expands to full viewport
- on-screen `X` button appears (top-right) to exit

This allows bigger player markers and cleaner tactical focus.

---

## 7. Tactical Engine Summary

### Core concepts

- Roles: `S`, `OH`, `OH2`, `MB`, `MB2`, `OPP`, `L`, `S2`
- Zones: `1..6`
- Phase/state:
  - `serving`
  - `receive`
  - `defense`

### Rotation mapping

Rotation uses a clockwise mapping model with `rot` (`R1..R6`) and lineup arrays.

### 5-1 template system

The app uses explicit per-rotation templates:

- `SERVE_51_TEMPLATES`
- `RECEIVE_51_TEMPLATES`

Each template maps zone -> `(x, y)` target position.

### Libero behavior (current implemented rule)

In `5-1`:

- Libero replaces `MB/MB2` in back-row zones.
- Exception: if `MB/MB2` is in `P1` while team is `serving`, MB serves (no libero replacement in that case).

### Overlap enforcement

Both precomputed and drag/live overlap constraints are enforced so players remain legal and inside bounds.

---

## 8. Court Rendering Model

Current view is **single half-court only** (team side), for better clarity:

- opponent half/team visuals removed
- larger player radius for readability
- optional zone-number overlays
- logo watermark rendered on court
- attack line currently solid (not dotted)

---

## 9. Draw Tools

Supported drawing objects:

- freehand lines
- arrows
- curves (double-click to finalize)

Drawings are stored in memory and included in undo/redo history.

---

## 10. State, History, and Persistence

### History

Undo/redo uses snapshot stacks with dedup guard and max history size.

### Reset

`Reset` restores tactical defaults and rebuilds positions.

### Persistence note

UI save/load buttons were intentionally removed from toolbar in the current version.
Internal snapshot/apply functions still exist for state management and history.

---

## 11. Theme / Branding

The current visual identity uses an IVI-inspired palette:

- deep navy backgrounds
- green active accents
- orange hover accents
- teal/peach top divider gradient

Branding integrations:

- logo in top header (left of title)
- large, subtle court watermark

---

## 12. Known Limitations (Current Snapshot)

1. 5-1 templates are the most refined tactical path.
2. `4-2` and `6-2` are available but not fully templated like 5-1.
3. Some legacy internal helper paths (flow/info hooks) remain in code even when related UI is hidden.
4. No backend, user accounts, or cloud sync.

---

## 13. Recommended Next Enhancements

1. Add full template sets for `4-2` and `6-2`.
2. Add scenario tabs (multiple tactical boards in one session).
3. Add export image with optional title strip (`System | Rotation | Phase`).
4. Add player names/roster presets.
5. Add “lock rotation” mode for teaching progression.
6. Add alignment fine-tune panel (nudge selected role by pixels and save template).

---

## 14. Developer Notes

### Main implementation files

- UI layout: [`index.html`](./index.html)
- Styling/theme: [`styles.css`](./styles.css)
- Tactical engine and rendering: [`script.js`](./script.js)

### Important internal functions (quick map)

- position calculation: `calcPositions()`
- phase branches: `calcServing()`, `calcReceive()`, `calcDefense()`
- 5-1 templates: `SERVE_51_TEMPLATES`, `RECEIVE_51_TEMPLATES`
- render loop: `render()`, `drawCourt()`, `drawPlayerObj()`, `drawAllDrawings()`
- interaction: `onDown()`, `onMove()`, `onUp()`
- controls: `setRot()`, `setPhase()`, `setFormation()`, `setTool()`
- display modes: `togglePresentationMode()`, `toggleZoneNumbers()`

---

## 15. License / Ownership

Add your preferred license here (e.g., MIT, proprietary internal use, etc.).

