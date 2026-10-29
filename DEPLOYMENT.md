# Deployment

## Netlify

The site deploys as static files from the repository root. `netlify.toml` sets `publish = "."`; there is no install or build command.

1. Connect the repository or drag the project folder into Netlify.
2. Confirm the publish directory is the repository root.
3. Deploy.
4. Check that `audio/`, `images/`, `referee.html`, `liveConfig.js`, and the Supabase function configuration references are published.
5. Open the deployed dashboard, generate a referee QR code, and test it from a different device.

## Environments

- **Local:** `http://127.0.0.1:5501/index.html` via `.local-server.cjs`.
- **Production:** Netlify HTTPS site.
- **Live data:** the existing Supabase production project referenced in `liveConfig.js`.

## Configuration

- `liveConfig.js` contains the public Supabase URL, publishable key, and Edge Function URL. These are safe to ship because the database remains protected by RLS and function tokens.
- Supabase service keys exist only in the Edge Function environment.
- Set the Supabase Edge Function secret `LIVE_MATCH_ALLOWED_ORIGINS` to the exact Netlify/custom dashboard origins allowed to create, update, and read live referee sessions. Include the local server origin only for development, for example `http://127.0.0.1:5501`.
- Set the Supabase Edge Function secret `LIVE_MATCH_CREATE_TOKEN` to a random 32-character-or-longer staff-only value. Scorers must enter this code when creating a new Second Referee QR session.
- Keep OBS placeholders in `obsClient.js` for production. Local OBS requires a trusted local setup.

## Rollback

Use Netlify's previous deployment rollback for static-site regressions. For Edge Function regressions, deploy the prior reviewed `supabase/functions/live-match/index.ts` version. Do not roll back or alter live database rows without confirming active match impact.

See [NETLIFY.md](NETLIFY.md) for existing hosting notes.
