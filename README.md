# fuel-finder-zh — nearby fuel stations for Zürich (local web app)

TypeScript + React + Vite frontend with a zero-dependency Node API server.
Finds petrol/diesel stations near an address (or your GPS position), shows
distances, prices (CHF/L), price timestamps and data sources, with a map and
per-station directions links.

## Quick start

```bash
npm install
npm run dev          # API on :8787 + web on http://localhost:5173
```

Open **http://localhost:5173**. The address field is prefilled with
`Oerlikon, Zürich, Switzerland` and a search runs automatically.

- Edit the address and hit **Find stations** (geocoded server-side via OSM
  Nominatim; the resolved WGS84 coordinates are shown).
- **Use my current location** requests browser GPS permission only on click.
- **Radius** 2–25 km (default 10). **Sort by** lowest price (distance as
  tie-breaker) or nearest.
- Separate lists: **Diesel**, **Petrol Super 95**, and — if the feed has it —
  **Super 98** (never mixed with 95). Stations without a price for that fuel
  are never ranked; they appear under “price unavailable”.
- 💰 cheapest / 📍 nearest / ⏳ stale (>24 h) badges, loading, empty and
  API-error states with retry.

Tests: `npm test` (vitest — distance math, sorting, missing prices, staleness).
Production build check: `npm run build`.

## Data sources — verified November 2026

| What | Source | Live? | Notes |
|---|---|---|---|
| Station locations, names, addresses | **OpenStreetMap via Overpass API** (mirrors: overpass-api.de, kumi.systems) | ✅ live | Free, ODbL; server sends a proper `User-Agent`, caches, backs off between mirrors. |
| Address → coordinates | **OSM Nominatim** | ✅ live | Usage policy respected: server-side, 1 req/1.1 s, 24 h cache. |
| **Station-level fuel prices** | **SAMPLE provider (synthetic)** | ❌ not live | See below — this is deliberate and honest. |

### Why prices are sample data in Switzerland

Verified during implementation (Nov 2026):
- The German open-data **Tankerkönig API** states in its own spec:
  *“Currently only prices for Germany are available.”* → no Swiss coverage.
- **Switzerland has no official per-station price disclosure.** The 2023
  motion 22.3804 (Austrian-style state price calculator) was rejected; the
  Federal Council’s 2026 answer (interpellation 26.3113) confirms prices are
  only posted at stations / in private apps. Official BFS data is national
  *averages* only, not station-level.
- Commercial CH station-price feeds exist (**tankbillig.ch B2B**, TCS, HERE
  Fuel Prices) but require a contract/API key; none was verifiable as free
  self-serve. Per the brief, nothing was scraped and no endpoints invented.

The UI therefore shows a loud **“SAMPLE DATA — NOT LIVE”** banner in sample
mode, and prices are labelled as such on every row.

## Going live (provider adapter)

Prices are fetched through one small interface —
`server/providers/types.ts` (`PriceProvider.getPrices()`). Swap providers via
env, no UI changes:

1. Copy `.env.example` → `.env` (never commit it).
2. Set `PRICE_PROVIDER=live` and your `TANKBILLIG_API_KEY` /
   `FUEL_PRICE_API_KEY` (key stays server-side; the browser never sees it).
3. Implement the fetch/merge in `server/providers/live.ts` against your
   contracted feed (map its station ids to OSM ids or match by coordinates;
   return per-fuel `{price, updated_at}`; omit fuels with no price).
4. The banner disappears automatically once `meta.live === true` — the UI
   reads the flag from the provider, it is never hard-coded.

## Architecture

```
Browser (React/Vite :5173)
  └─ /api/* ─→ Node API (:8787, server/server.ts)
                ├─ /api/geocode   → Nominatim (UA + throttle + cache)
                └─ /api/stations  → Overpass (stations) + PriceProvider
                                     ├─ sample.ts (default, labelled)
                                     └─ live.ts   (integration point, key via .env)
```

All upstream keys/UA handling live server-side; the frontend only talks to
`/api` (proxied by Vite), so no third-party secrets or browser-CORS issues.

## Limitations

- Overpass/Nominatim are shared community services: occasional 429/latency —
  first load can take ~30–60 s when Overpass is busy (75 s per-mirror timeout,
  mirror fallback, and a 5-minute in-memory cache so retries/ radius changes
  are instant). Clear errors with a Retry button are surfaced in the UI.
- OSM station data is crowd-sourced (ODbL — attribution shown); closures or
  missing stations are possible.
- Sample prices are synthetic and deterministic — **never usable for
  decisions**. Verify real prices with your chosen provider before relying
  on this tool.
- Directions links open Google Maps; map tiles © OpenStreetMap contributors.
