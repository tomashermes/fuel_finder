/** Local API server (Node, no dependencies — uses native fetch + type-stripped TS).
 *
 *  Responsibilities:
 *   - /api/geocode  : proxy OSM Nominatim with a compliant User-Agent + cache
 *   - /api/stations : OSM Overpass station lookup + price provider adapter
 *
 *  A future price provider's API key stays here (server-side, .env) and is
 *  never sent to the browser.
 */
import { createServer } from "node:http";
import { geocode, findStations } from "./osm.ts";
import { getPriceProvider } from "./providers/index.ts";
import { haversineKm } from "../src/lib/geo.ts";
import type { SearchResponse, Station } from "../src/lib/fuel.ts";

const PORT = Number(process.env.API_PORT ?? 8787);
const priceProvider = getPriceProvider();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/api/health") {
    return json(200, { ok: true, price_provider: priceProvider.meta });
  }

  if (url.pathname === "/api/geocode") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 4) return json(400, { error: "Address query is too short." });
    try {
      const result = await geocode(q);
      if (!result) return json(404, { error: `Address not found: “${q}”` });
      return json(200, { result, source: "OpenStreetMap Nominatim" });
    } catch (e) {
      return json(502, { error: `Geocoder error: ${(e as Error).message}` });
    }
  }

  if (url.pathname === "/api/stations") {
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const radius = Math.min(Math.max(Number(url.searchParams.get("r") ?? 10), 1), 25);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return json(400, { error: "lat and lon are required numbers." });
    }
    try {
      const { stations, osmBase, mirror } = await findStations(lat, lon, radius);
      const prices = await priceProvider.getPrices(stations);
      const withDist: Station[] = stations.map((s) => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
        address: s.address,
        lat: s.lat,
        lon: s.lon,
        distance_km: Math.round(haversineKm({ lat, lon }, { lat: s.lat, lon: s.lon }) * 100) / 100,
        prices: prices[s.id] ?? {},
        location_source: `OpenStreetMap (Overpass: ${mirror.replace("https://", "").replace("/api/interpreter", "")})`,
        price_source: priceProvider.meta,
      }));
      const body: SearchResponse = {
        origin: { lat, lon, label: url.searchParams.get("label") ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}` },
        radius_km: radius,
        station_count: withDist.length,
        location_meta: { provider: "OpenStreetMap", osm_base_timestamp: osmBase },
        price_meta: priceProvider.meta,
        stations: withDist,
      };
      return json(200, body);
    } catch (e) {
      const status = (e as Error & { statusCode?: number }).statusCode ?? 502;
      return json(status, { error: (e as Error).message ?? "Upstream failure" });
    }
  }

  return json(404, { error: "Not found" });
}

const server = createServer((req, res) => {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(", ");
  }
  handle(new Request("http://x" + req.url, { method: req.method, headers }))
    .then(async (r) => {
      res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
      res.end(await r.text());
    })
    .catch((e) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[api] listening on http://localhost:${PORT} (price provider: ${priceProvider.meta.id})`);
});
