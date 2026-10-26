# Changelog

## Unreleased

- V3: Added calibrated 5-1 layouts for Receiving Rotation 1 and for all Rotation 2 phases: receiving, serving, and base. Remaining uncalibrated phase/rotation combinations remain in the standard court view. The former Receive Formation button toggles the main court to Base Rotation. Active libero markers now identify the role and jersey number they replace.
- V3: Completed the missing 5-1 live-court templates from the volleyball-rotations.com reference model. Rotation 1 and 2 manual calibrations remain authoritative; the other receiving, serving, and base layouts use the reference-derived fallback and rotate 180 degrees on the right court.
- V3: Reset tactical formation templates to rebuild them from Rotation 1 against the centre-net court. The full-court net is now visually reinforced as the fixed centre divider; official base rotation and all match rules remain active.
- V3: Added a new six-rotation 5-1 serving/receiving test based on volleyball-rotations.com. Its top-net source coordinates are transformed so both teams face the fixed centre net, and libero replacement is determined from the active match lineup rather than hard-coded to one middle blocker.
- V3: Removed the unsuccessful reference-derived formation test and reset tactical templates for manual calibration. Formation Editor now supports marking and clearing the server role in exported layout data.
- V3: Added manually calibrated left-court receiving, serving, and base templates for Rotations 1 and 2. The selected server role is now used only to highlight the server in a serving formation; official service order remains match-controlled.
- V3: Added a temporary drag-based Formation Editor that exports selected phase and rotation coordinates for calibration.
- Restored V2.4 as the active scorer layout. The V3 tactical-formation renderer and Formation Editor are no longer available in the interface; the main court again uses the official P1-P6 rotation display and Receive Formation returns to its focused V2.4 workspace.
- Reverted the V2.4 main-court receive-formation trial after validation. The main court remains the stable P1-P6 rotation view; Receive Formation remains modal-only.
- Added confirmed set and match completion workflow: normal sets end at 25 and tiebreaks at 15, both requiring a two-point lead. Extended scores are supported, Set 5 requires first-server and starting-side choices, and sides now switch automatically once at 8 points.
- Removed the temporary sample roster loader and cleared the seeded sample player data so official lineups begin empty.
- Reduced the timeout introduction delay from four seconds to two seconds before the 30-second clock starts.
- Added the Ravens player profile from the 2026/27 licence sheet, with editable preloaded names, blank jersey-number fields, and court portraits linked after a lineup is saved.
- Populated the Ravens profile with the supplied jersey numbers, including Emmeleia Arakleitou (#20), and set Dimitra Palla (#11) as the active L1 libero.
- Added Daniele Valenca (#25) and her live-court portrait to the Ravens roster profile.
- V2.4: Split the shared lineup overlay into focused Lineups and Receive Formation views; mirrored the away score-banner order so its score and set tally sit beside the centre panel and team identity remains at the outer edge.
- V2.3: Made libero replacement follow a substituted eligible player, added free two-libero switching, and added current-set 5-1 role overrides for inversions that reset at the next set.
- V2.2: Added a persistent team-and-player serving indicator, aligned right-side set totals with the score, added player names to lineup rows, and added lineup drag-and-drop for starting positions and 5-1 court roles.
- V2.1: Removed the duplicate serving marker, moved match-ending controls below the court, tightened top-bar setup placement, and corrected the right-court position order.
- Added the V2 desktop scorer workstation with dedicated team-side on-court and bench lists.
- Added the shared full-court rotation and server-order map with the scorer-facing vertical-net orientation.
- Added desktop drag-and-drop substitution entry points; existing paired-substitution, libero, and eight-per-set validation remains authoritative.
- Kept the separate scoreboard window, audio panel, and second-referee QR workflow unchanged.

All notable changes are recorded here. Versions are not yet formally released.

## Unreleased

### Added

- Volleyball match scoring, tiebreak, court-side rotation, libero, and substitution workflows.
- Removed the Live Court overlap checker and its visual position editor.
- 5-1 receive plans and per-team 5-1/6-0 selection.
- Audio panel, timeout cues, fan scoreboard, printable register, and optional OBS sync.
- QR-generated, Supabase-backed read-only second-referee view.
- Project documentation set.

### Changed

- Auxiliary scoreboard now emphasizes team names, set totals, scores, and serving indicator.
- Team setup suggests registered logo-bearing teams and accepts custom teams without a fallback logo.

### Security

- Live matches use hashed random access tokens and RLS-protected database storage.
