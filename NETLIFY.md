# Netlify Deployment Notes

This is a static site. Netlify can publish the repository root using the included `netlify.toml`; no build command is required.

Before production use, configure access control in Netlify. The dashboard has no sign-in system, so anybody who can reach a public URL can change the live score.

Keep `obsClient.js` on its placeholder values for any hosted deployment. Do not place an OBS password in browser JavaScript. An HTTPS Netlify site cannot directly use an unsecured `ws://` connection to OBS on a local network. Use the dashboard locally for OBS, or add a trusted authenticated bridge with secure WebSocket support before enabling remote OBS control.

After deploying, use Netlify's Deploy File Explorer to confirm that `audio/` and `images/` are included in the published files.

