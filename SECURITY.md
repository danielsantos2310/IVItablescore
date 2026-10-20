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

## Secrets and Integrations

- Never replace `IP_ADDRESS`, `PORT`, or `PASSWORD` placeholders in `obsClient.js` in a public hosted deployment.
- Do not put Supabase secret/service keys, Netlify tokens, OBS passwords, or QR staff tokens in source control, logs, screenshots, or documentation.
- Treat referee QR URLs as sensitive match data. Regenerate a session by starting a new match when a link must no longer be used.

## Headers and Privacy

- Netlify supplies `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a restrictive `Permissions-Policy`.
- `referee.html` is served with `Cache-Control: no-store`.
- The live match snapshot can contain team and player numbers. Do not add personal player details to it unless privacy requirements are reviewed.

## Reporting

Report suspected vulnerabilities privately to the project owner. Include reproduction steps, affected page/function, and any data exposure observed. Do not publish active tokens or exploit details.

