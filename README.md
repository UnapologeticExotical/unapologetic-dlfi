# DLFI — Department of Lace Front Investigations

A clean, production-ready build of the site, ready to deploy to Netlify.

## Deploy to Netlify (drag & drop — easiest)

1. Go to **https://app.netlify.com/drop**
2. **Drag this entire folder** (the one containing `index.html`) onto the page.
3. Wait a few seconds. Netlify gives you a live URL.
4. (Optional) Click "Claim site" to attach it to a free Netlify account so you can give it a custom domain and update it later.

## Update the site later

After the first drop, your site has a settings page on Netlify. To push an update:
- Open your site on Netlify → **Deploys** tab
- Drag the same folder onto the drop area again. Done — new version goes live.

## What's inside

- `index.html` — main page (Netlify serves this by default)
- `dlfi-styles.css`, `dlfi-recruitment.css`, `dlfi-extras.css`, `dlfi-mobile.css` — all stylesheets
- `dlfi-app.js`, `dlfi-audio.js`, `dlfi-extras.js`, `dlfi-mobile.js`, `dlfi-recruitment.js` — site scripts
- `manifest.json` — PWA manifest so visitors can pin DLFI to their home screen
- `sw.js` — service worker for offline caching
- `img/` — case photos, evidence images, agent portraits, PWA icons
- `netlify.toml` — Netlify config (proper headers for the service worker)

## Custom domain

In Netlify, go to **Domain settings → Add custom domain** and follow the prompts. You'll either:
- Buy a domain through Netlify (one click), OR
- Point an existing domain's DNS at Netlify (they walk you through it).

## That's it. The Department is ready for field deployment.
