# BTC/USDT Next.js Dashboard

A hosted, export-ready Next.js project for a BTC/USDT dashboard with:
- fallback-first rendering
- live data via server routes
- timeframe switching
- clickable signal alerts
- April news calendar
- mobile-safe architecture for iPhone and laptop

## Why this version works better
Your local HTML files failed because live APIs from a `file://` origin are unreliable. This project fixes that by using:
- a real web app origin (`https://...`)
- server routes under `/api/*`
- fallback data first, then live replacement

## Project structure
- `app/page.tsx` – main page
- `components/DashboardClient.tsx` – client dashboard UI
- `app/api/btc/route.ts` – BTC candle route
- `app/api/context/route.ts` – macro/context route
- `lib/market.ts` – fallback data + calculations
- `lib/types.ts` – shared types
- `app/globals.css` – styling

## Local setup
1. Install Node.js 20+.
2. Open terminal in the project folder.
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Vercel deploy
1. Create a GitHub repo.
2. Upload this project.
3. Go to Vercel.
4. Import the GitHub repo.
5. Framework preset: Next.js.
6. Deploy.

## Netlify deploy
1. Push the repo to GitHub.
2. In Netlify, import the repo.
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Deploy.

## Important notes
- The DXY route currently uses a placeholder FRED API key string. Replace it with a real FRED key if you want live DXY.
- Binance can rate-limit or geo-limit. If that happens, add another server-side fallback source.
- This is a practical dashboard, not institutional orderflow software.

## Recommended next upgrades
- add auth and saved layouts
- add true server-side caching
- add webhook/Telegram alerts
- add better economic calendar source
- add real volume profile and FVG engine
