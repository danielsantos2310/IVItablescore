# Roadmap

## Completed

- Core best-of-five scoring, fifth-set tiebreak, side switch, timers, sanctions, undo, and results.
- Audio control panel and large auxiliary fan scoreboard.
- Team logos, visitor placeholder handling, team register, and printable pages.
- Lineups, libero logic, service order, rotations, overlap helper, 5-1 receive visualization, and 6-0 mode.
- Per-set substitution rules: maximum eight substitutions and paired return restrictions.
- Supabase-backed QR sharing and a read-only second-referee view.
- Netlify static-hosting configuration and baseline security headers.

## Current Phase

V3 live-court validation: use live fixtures to confirm the receiving-team 5-1 formation, base-rotation toggle, roster-side substitution workflow, scoring, rotations, referee sharing, audio timing, and separate-monitor scoreboard visibility on venue hardware.

## Next

- Add named visitor-logo files to `images/Visitor teams/` and register them in `VISITOR_TEAM_LOGOS`.
- Add browser-level tests for the dashboard, popup scoreboard, and referee QR flow.
- Add a documented cleanup/retention task for old `live_matches` rows.
- Review the referee refresh interval against venue Wi-Fi performance.

## Longer Term

- Authenticated staff accounts and match history.
- Controlled match export/import and official result archiving.
- A secure on-premise OBS bridge for hosted dashboards.
- Expanded reports and accessibility audit with real scorer-table users.
