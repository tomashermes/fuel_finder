/** OSM data access: Nominatim geocoding + Overpass station query.
 *  Server-side so we can send the required User-Agent (Nominatim policy)
 *  and add caching/backoff (Overpass fair-use). */
import { haversineKm } from "../src/lib/geo.ts";

const UA = "fuel-finder-zh/0.1 (local dev app; localhost only)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
}

// --- tiny TTL cache + 1.1s min spacing (Nominatim usage policy) ---
const geoCache = new Map<string, { at: number; value: GeocodeResult | null }>();
let lastNominatim = 0;

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase();
  const hit = geoCache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.value;

  const wait = lastNominatim + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();

  const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const value = data.length
    ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display_name: data[0].display_name }
    : null;
  geoCache.set(key, { at: Date.now(), value });
  return value;
}

export interface RawStation {
  id: string;
  name: string;
  brand?: string;
  address?: string;
  lat: number;
  lon: number;
}

function addrTag(t: Record<string, string>): string | undefined {
  const street = t["addr:street"];
  const hn = t["addr:housenumber"];
  const pc = t["addr:postcode"];
  const city = t["addr:city"];
  const parts = [street && hn ? `${street} ${hn}` : street, [pc, city].filter(Boolean).join(" ")];
  const s = parts.filter(Boolean).join(", ");
  return s || undefined;
}

export async function findStations(
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<{ stations: RawStation[]; osmBase?: string; mirror: string }> {
  // small cache: Overpass is a shared community API; identical searches
  // within 5 minutes are served from memory (keeps retries/Radius toggles fast)
  const ck = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusKm}`;
  const hit = stationCache.get(ck);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;
  const value = await queryStations(lat, lon, radiusKm);
  stationCache.set(ck, { at: Date.now(), value });
  return value;
}

const stationCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof queryStations>> }>();

async function queryStations(
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<{ stations: RawStation[]; osmBase?: string; mirror: string }> {
  const r = Math.min(radiusKm, 25);
  // bbox is far cheaper than around(); we re-filter by great-circle distance below.
  const dLat = r / 111.32;
  const dLon = r / (111.32 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon}`;
  const q =
    `[out:json][timeout:25];` +
    `(node["amenity"="fuel"](${bbox});way["amenity"="fuel"](${bbox}););` +
    `out center tags;`;

  let lastErr: unknown;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(75_000),
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const data = await res.json();
      const seen = new Set<string>();
      const stations: RawStation[] = [];
      for (const el of data.elements ?? []) {
        const id = `${el.type}/${el.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const t = el.tags ?? {};
        const la = el.lat ?? el.center?.lat;
        const lo = el.lon ?? el.center?.lon;
        if (typeof la !== "number" || typeof lo !== "number") continue;
        if (haversineKm({ lat, lon }, { lat: la, lon: lo }) > radiusKm) continue;
        stations.push({
          id,
          name: t.name || t.brand || "Fuel station",
          brand: t.brand,
          address: addrTag(t),
          lat: la,
          lon: lo,
        });
      }
      return {
        stations,
        osmBase: data.osm3s?.timestamp_osm_base,
        mirror,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Overpass unavailable (all mirrors): ${(lastErr as Error)?.message}`);
}
