# CeduSync — Staff Web App

React 19 (Create React App) desktop app for barangay staff: voice interview, QR scan, records,
staff management and settings. Talks to the CeduSync backend API (`capstone_backend`).

## Run locally
```bash
npm install
npm start          # http://localhost:3000, expects the backend on port 8000
```
Without a `.env`, the app calls `http://<the computer serving the page>:8000/api`, so other devices
on the same Wi-Fi can open `http://<this-computer's-IP>:3000`.

## Backend address (`REACT_APP_API_URL`)
Copy `.env.example` to `.env` and set `REACT_APP_API_URL=https://<backend-address>/api`.

**It is read at build time.** `npm run build` writes the value into the files in `build/`.
After changing it, build and deploy again — changing it on the host alone does nothing.

## Deploy (static hosting)
1. Set `REACT_APP_API_URL` to the deployed backend (must be **https**).
2. Build command `npm run build`, publish directory `build`.
3. The site must be served over **https**: the interview microphone and the QR camera only work on https pages.
4. Deep links (e.g. reloading `/records`) need an SPA rewrite to `index.html`. Included:
   - `public/_redirects` — Netlify and Cloudflare Pages (copied into `build/` automatically)
   - `vercel.json` — Vercel

   On another host, add a rewrite "all paths → `/index.html` (200)" in its settings.
5. Add the site's https address to the backend's `CORS_ORIGINS`.

Full hosting checklist: `capstone_docs/DEPLOY.md` in the CeduSync workspace.

## Checks
- Lint: `npx eslint src --ext .js,.jsx` (without `--ext`, ESLint 8 skips `.jsx` files)
- Build: `npm run build`
