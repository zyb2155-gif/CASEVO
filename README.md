# CASEVO — Cloudflare Workers Static Site

This version fixes the 502 issue by deploying the HTML/CSS/JS as Cloudflare Workers Static Assets.

Cloudflare settings:
- Build command: None
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Production branch: `main`

Keep the existing `getcasevo.com/* -> casevo` route.
