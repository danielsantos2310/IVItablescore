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

Copy uses direct volleyball terms: serving, receiving, current server, next, and rotation.

## Do's and Don'ts

- **Do:** Keep scoring available without requiring verification steps.
- **Do:** Pair every color state with text.
- **Don't:** Allow dynamic labels or status text to resize core controls.
- **Don't:** introduce decorative gradients, floating cards within cards, or marketing-page composition.
- **Don't:** communicate a rule result using color alone.

## Responsive Rules

- Main dashboard: keep scoring actions visible; hide the expandable timeline on narrow screens.
- Lineup and rotation workspace: stack team panels below 900px without removing player or server data.
- Referee view: stack rotation cards below 620px and retain the visible receive court.
- Auxiliary scoreboard: prioritize names, set totals, scores, and serving marker; set totals sit at the inner top corners and serving markers at outer top corners.

## V2 Scorer Workstation

V2 replaces the V1 two-column scorer surface on desktop. It keeps the existing match engine and external windows, but presents the active match as a three-column workstation:

- Team A and Team B each have a dedicated side panel with on-court players, bench players, libero, substitutions, timeouts, and sanctions.
- The centre panel is a full shared court with a vertical net. It shows both teams' P1-P6 order, active libero, and highlighted current server.
- The court orientation is scorer-facing: left court positions are P5/P4, P6/P3, P1/P2 from top to bottom; the right court mirrors this arrangement.
- The lineup editor remains an overlay. The detailed rotation and 5-1 receive view remain available from that workspace.
- Audio, referee QR sharing, the separate-monitor scoreboard, print/export, and match actions remain independent tools in the utility bar.

V2 uses green and orange only as team-side accents. Libero and serving states also include text labels and never rely on colour alone.

### V2.1 refinements

- The score banner shows serving information once, through the labelled serving state at the far edge. It does not duplicate the serving ball within a team score card.
- End-set and end-match actions sit beneath the central court, separated from the persistent utility tools.
- Match setup stays immediately beside the IVI identity; New / Reset Match occupies the far right of the top bar.
- The right-court scorer-facing order is P2/P1, P3/P6, P4/P5 from top to bottom.

### V2.2 refinements

- The central status row persistently identifies the serving team and current server number until service changes.
- Each side of the score banner keeps the set total adjacent to its score.
- Lineup roster entry uses compact jersey-number and player-name rows. Regular-player rows can be dragged into starting positions and 5-1 role targets; direct number entry remains available for keyboard and touch operation.

### V2.3 substitution and libero rules

- A regular substitute inherits the outgoing player's rotation position and live court role.
- A libero replacement follows the eligible configured position through a standard substitution. If the configured player is replaced, the libero replaces that substitute until the pair returns or the set ends.
- Standard substitutions remain paired and limited to eight per set. Libero exchanges never create a pair or increment the substitution count.
- When two liberos are registered, the live libero label can switch between them without recording a substitution.
- A 5-1 inversion uses a current-set role override. It can assign current on-court substitutes as Setter or Opposite and resets to the saved lineup roles at the next set.

### V2.4 focused workspaces

- `Set Lineups & Libero` opens roster, starting-six, libero, and role entry only.
- `Receive Formation` opens the current receiving team's 5-1 court only. It does not require the scorer to scroll through lineup controls.

## V2 Live Court

- The main court shows the official P1-P6 rotation and the current server for both teams.
- `Receive Formation` opens the V2.4 focused workspace for the receiving team without changing the main court.
- Teams set to 5-1 or 6-0 use the same reliable base-rotation display; tactical formations are not part of V2.

## Set Completion

- Sets 1-4 require 25 points and a two-point lead; Set 5 requires 15 points and a two-point lead. Extended scores remain valid when the lead is two points.
- Eligible set and match endings use an app-owned confirmation dialog that locks scoring until the scorer confirms or continues play.
- Before Set 5 begins, the scorer selects the first serving team and which team starts on the left. At 8 points in Set 5, the physical court sides and score placement switch automatically once.
