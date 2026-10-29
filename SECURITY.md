# Security

## Security Model

- The scorer dashboard is an operational tool, not an authenticated public application. Restrict access at Netlify until staff authentication exists.
- The second-referee QR URL is a bearer link. Anyone with the URL can read that live match until the link is retired or the row is removed.
- The referee token never grants scoring or database-write access. The staff token is stored only in the scorer browser's local storage.

## Supabase

- `public.live_matches` has RLS enabled and no direct client policies. Browser clients cannot query the table directly.
- The `live-match` Edge Function uses a Supabase secret/service key only inside the function runtime.
- The browser contains only the publishable key in `liveConfig.js`; it is not a secret.
- Tokens are random 32-byte URL-safe values and only SHA-256 hashes are stored in the database.
- Set `LIVE_MATCH_ALLOWED_ORIGINS` in Supabase to a comma-separated allowlist of the deployed dashboard origins, for example `https://your-site.netlify.app,https://score.example.org`. The function rejects requests without an allowed `Origin` header.
- Set `LIVE_MATCH_CREATE_TOKEN` in Supabase to a random staff-only value of at least 32 characters. A scorer enters it when creating a new referee QR session; it is never stored in browser storage or source control.
- Protect the scorer dashboard itself with Netlify access control or an equivalent staff authentication layer. Origin checks reduce cross-site browser access but are not a replacement for staff authentication or rate limiting.

## Secrets and Integrations

- Never replace `IP_ADDRESS`, `PORT`, or `PASSWORD` placeholders in `obsClient.js` in a public hosted deployment.
- Do not put Supabase secret/service keys, Netlify tokens, OBS passwords, or QR staff tokens in source control, logs, screenshots, or documentation.
- Treat referee QR URLs as sensitive match data. Regenerate a session by starting a new match when a link must no longer be used.

## Headers and Privacy

- Netlify supplies `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a restrictive `Permissions-Policy`.
- `referee.html` is served with `Cache-Control: no-store`.
- The live match snapshot can contain team and player numbers. Do not add personal player details to it unless privacy requirements are reviewed.
- User-entered names must be rendered with DOM APIs or escaped text, never interpolated into `innerHTML`.

## Reporting

Report suspected vulnerabilities privately to the project owner. Include reproduction steps, affected page/function, and any data exposure observed. Do not publish active tokens or exploit details.
