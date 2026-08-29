# CASEVO Upgrade — real product photography + checkout buttons

This is a static Cloudflare Workers/Pages-compatible site.

## Files
- index.html
- style.css
- script.js
- assets/ (generated CASEVO product photography)

## Make payments live
Open `script.js` and replace the six:
- `PASTE_STRIPE_PAYMENT_LINK_*` with Stripe Payment Links
- `PASTE_SHOPIFY_CHECKOUT_URL_*` with Shopify checkout/product URLs

The UI already has separate Stripe and Shopify purchase buttons.

## Deploy
For your current Cloudflare setup, keep the root directory `/` and deploy the repository as a static site.
Do not use `npx wrangler deploy` with an `assets.directory` that does not exist.
If using Workers Static Assets, use `assets.directory: "."` as in `wrangler.jsonc`.

## Important
The included product photos are generated CASEVO art-direction/product visuals, not photographs of a physical manufactured case. Before commercial launch, replace them with your final factory/product photography if available.
