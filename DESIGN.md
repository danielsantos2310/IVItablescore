---
version: alpha
name: "IVI Volleyball Match Console"
description: "A dense, courtside scoring console using club colors and referee-style status cues."
colors:
  background: "#071525"
  surface: "#0F2236"
  field: "#081A2A"
  primary: "#00A651"
  secondary: "#FF6F00"
  text: "#E5F0FF"
  muted: "#8FA2C2"
typography:
  sans:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
rounded:
  DEFAULT: "0.375rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  control-gap: "0.5rem"
  section-gap: "0.75rem"
components:
  button: { }
  card: { }
  dialog: { }
  court: { }
---

# IVI Volleyball Match Console Design System

## Overview

### Creative North Star

The interface should feel like a courtside officials' console: immediate, legible at a glance, and driven by match state rather than decoration. Lineup and rotation work belongs in a closable right-column workspace so scoring remains available.

### Product context and register

- **Audience and primary job:** Volleyball scorers operating a live match and broadcast scoreboard.
- **Target market(s) and evidence:** IVI club competition, based on the match controls, club branding, and 26/27 season label in the product.
- **Locale(s) and language policy:** English UI with concise volleyball terminology.
- **Usage scene:** Laptop and phone use beside the court, with repeated actions under time pressure.
- **Register:** Product dashboard.
- **Memorable signature:** Green and orange team actions paired with a compact six-position court diagram.
- **Restraint:** Match controls, scores, and status feedback remain compact and predictable.
- **Anti-references:** Marketing layouts, decorative dashboards, and low-density card collections.
- **Token ownership/runtime mapping:** This file mirrors the canonical runtime variables and component rules in `styles.CSS`.

## Colors

| Token | Value | Usage |
| --- | --- | --- |
| Background | `#071525` | Page and broadcast background |
| Surface | `#0F2236` | Cards, panels, scoreboard teams |
| Field | `#081A2A` | Inputs and dense data cells |
| Primary | `#00A651` | Team-A action, valid/current state |
| Opposing action | `#FF6F00` | Team-B action and attention |
| Text | `#E5F0FF` | Scores and primary information |
| Muted | `#8FA2C2` | Labels, metadata, and secondary information |

The dark navy background and surfaces reduce glare. Green is reserved for primary/valid states; orange identifies the opposing scoring action and warnings. Red identifies errors or mismatches. Text uses `text` and `muted` roles, with borders derived from the existing blue-gray surface family.

## Typography

The canonical font stack is `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Scores use heavy, high-contrast numerals. Labels remain compact and sentence case or restrained uppercase for operational grouping. Do not use viewport-based font scaling in the dashboard; broadcast scoreboard sizing may use bounded `clamp()` values because it is intended for varied display resolutions.

## Layout

Desktop uses a score-and-controls column beside the timeline. The lineup workspace is opened when needed rather than permanently consuming scoring space. Mobile hides the timeline and stacks dense controls. Fixed-format score, rotation, court, and scoreboard elements use explicit grids, constrained tracks, or aspect ratios to prevent state changes from shifting layout.

## Elevation & Depth

Tonal surface changes and borders establish hierarchy. Shadows are limited to major application surfaces, popups, and active controls.

## Shapes

Operational panels and court cells use 6-8px radii. Existing primary action buttons retain their pill treatment; dense tool controls use smaller radii.

## Components

### Foundational visual states

Green communicates valid/current states, orange communicates attention, and red communicates mismatches. Disabled controls retain their dimensions and native semantics.

### Buttons and actions

Large green/orange buttons are reserved for scoring. Secondary controls use the blue-gray surface. Dangerous match-ending actions remain orange and spatially separated.

### Navigation and data display

Match state stays in one view. Rotation grids use volleyball positions `P1-P6`, with the server and libero visually distinguished.

### Forms and overlays

Inputs use the dark field surface and visible borders. Dialogs remain within the viewport, restore focus on close, and provide non-drag controls for spatial editing.

### Iconography

The volleyball image identifies service. Text labels remain present for operational actions.

### Motion

Motion is limited to immediate pressed and state-change feedback. The serving-ball indicator may change visibility but no information relies on animation. Reduced-motion users should not lose any status information.

### Content and data visualization

Copy uses direct volleyball terms: serving, receiving, current server, next, overlap, and rotation.

## Do's and Don'ts

- **Do:** Keep scoring available without requiring verification steps.
- **Do:** Pair every color state with text.
- **Don't:** Claim that a manually positioned diagram is an official overlap decision.
- **Don't:** Allow dynamic labels or status text to resize core controls.
- **Don't:** introduce decorative gradients, floating cards within cards, or marketing-page composition.
- **Don't:** communicate a rule result using color alone.

## Responsive Rules

- Main dashboard: keep scoring actions visible; hide the expandable timeline on narrow screens.
- Lineup and rotation workspace: stack team panels below 900px without removing player or server data.
- Referee view: stack rotation cards below 620px and retain the visible receive court.
- Auxiliary scoreboard: prioritize names, set totals, scores, and serving marker; set totals sit at the inner top corners and serving markers at outer top corners.

