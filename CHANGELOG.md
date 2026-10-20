# Changelog

All notable changes are recorded here. Versions are not yet formally released.

## Unreleased

### Added

- Volleyball match scoring, tiebreak, court-side rotation, libero, substitution, and overlap workflows.
- 5-1 receive plans and per-team 5-1/6-0 selection.
- Audio panel, timeout cues, fan scoreboard, printable register, and optional OBS sync.
- QR-generated, Supabase-backed read-only second-referee view.
- Project documentation set.

### Changed

- Auxiliary scoreboard now emphasizes team names, set totals, scores, and serving indicator.
- Team setup suggests registered logo-bearing teams and accepts custom teams without a fallback logo.

### Security

- Live matches use hashed random access tokens and RLS-protected database storage.

