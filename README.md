# IVI Volleyball Match Console

Browser-based volleyball scoring console for IVI's 2026/27 season. It runs the match at the scorer's table, opens a fan-facing scoreboard window, supports a printable team register, and can share a read-only live rotation view with a second referee.

## Features

- Best-of-five scoring, fifth-set tiebreak, timeouts, sanctions, undo, and manual end-set checks.
- Team lineups, libero replacement rules, rotations, service-order checks, overlap assistant, 5-1 receive plans, and 6-0 mode.
- Per-set substitution limit of eight, with paired substitution enforcement.
- Audio panel, auxiliary scoreboard, optional OBS WebSocket output, and print/export views.
- QR-sharing to a read-only referee page backed by Supabase.

## Run locally

No package installation or build step is required. Use the bundled local server:

```powershell
& 'C:\Users\ferreoda\Desktop\daniel-santos-portfolio-master\.tools\node-v22.23.3-win-x64\node.exe' .local-server.cjs
```

Open `http://127.0.0.1:5501/index.html`.

Open `register.html` for the printable team register. The scoreboard is opened from the dashboard. The referee link is generated from `Second Referee QR`.

## Test

```powershell
& 'C:\Users\ferreoda\Desktop\daniel-santos-portfolio-master\.tools\node-v22.23.3-win-x64\node.exe' tests\matchRules.test.js
& 'C:\Users\ferreoda\Desktop\daniel-santos-portfolio-master\.tools\node-v22.23.3-win-x64\node.exe' --check script.js
```

## Deploy

The project is a static Netlify site. Publish the repository root using `netlify.toml`; no build command is needed. See [DEPLOYMENT.md](DEPLOYMENT.md) and [NETLIFY.md](NETLIFY.md).

## Documentation

- [DESIGN.md](DESIGN.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
- [API.md](API.md) and [DATABASE.md](DATABASE.md)
- [TESTING.md](TESTING.md), [SECURITY.md](SECURITY.md), and [CONTRIBUTING.md](CONTRIBUTING.md)
- [ROADMAP.md](ROADMAP.md), [TODO.md](TODO.md), [CHANGELOG.md](CHANGELOG.md), and [DECISIONS.md](DECISIONS.md)

