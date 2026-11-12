/** Fuel and station domain model + ranking rules (single source of truth
 *  for frontend and local server). */

export type FuelKey = "diesel" | "super95" | "super98";

export const FUEL_LABEL: Record<FuelKey, string> = {
  diesel: "Diesel",
  super95: "Petrol Super 95 (unleaded)",
  super98: "Petrol Super 98 (premium)",
};

export interface PriceInfo {
  /** CHF per litre */
  price: number;
  /** ISO timestamp of when this station-level price was published/updated */
  updated_at: string;
}

export interface Station {
  id: string;
  name: string;
  brand?: string;
  address?: string;
  lat: number;
  lon: number;
  distance_km: number;
  /** Absent fuel => no price data for it */
  prices: Partial<Record<FuelKey, PriceInfo>>;
  /** Where the STATION LOCATION data comes from */
  location_source: string;
  /** Where the PRICE data comes from (per response; kept on station for display) */
  price_source: PriceSourceMeta;
}

export interface PriceSourceMeta {
  id: string;
  label: string;
  /** false in sample mode — UI must then show a loud "not live" badge */
  live: boolean;
  url?: string;
  note?: string;
}

export interface SearchResponse {
  origin: { lat: number; lon: number; label: string };
  radius_km: number;
  station_count: number;
  location_meta: { provider: string; osm_base_timestamp?: string };
  price_meta: PriceSourceMeta;
  stations: Station[];
}

export type SortMode = "price" | "nearest";

export const STALE_HOURS = 24;

export function isStale(updatedAtIso: string, nowMs: number = Date.now(), hours: number = STALE_HOURS): boolean {
  const t = Date.parse(updatedAtIso);
  if (Number.isNaN(t)) return true; // unparseable timestamp counts as stale/unknown
  return nowMs - t > hours * 3600 * 1000;
}

export interface RankedResult {
  ranked: Station[]; // has a price for this fuel, sorted
  unavailable: Station[]; // within radius but no price for this fuel
  cheapest?: Station;
  nearest?: Station; // nearest among ALL stations (ranked or not)
  stale: Set<string>; // ids whose price is older than STALE_HOURS
}

/** Rank stations for one fuel. Stations WITHOUT a price for this fuel are
 *  never ranked (no fake positions in the price order) — they are returned
 *  separately as `unavailable`, still sorted by distance. */
export function rankStations(
  stations: Station[],
  fuel: FuelKey,
  mode: SortMode,
  nowMs?: number,
): RankedResult {
  const priced = stations.filter((s) => s.prices[fuel] !== undefined);
  const unpriced = stations
    .filter((s) => s.prices[fuel] === undefined)
    .sort((a, b) => a.distance_km - b.distance_km);

  const priceOf = (s: Station) => s.prices[fuel]!.price;
  const byPrice = [...priced].sort(
    (a, b) => priceOf(a) - priceOf(b) || a.distance_km - b.distance_km,
  );
  const byDistance = [...priced].sort(
    (a, b) => a.distance_km - b.distance_km || priceOf(a) - priceOf(b),
  );

  const ranked = mode === "nearest" ? byDistance : byPrice;
  const cheapest = byPrice[0];
  const nearest = [...stations].sort((a, b) => a.distance_km - b.distance_km)[0];
  const stale = new Set(
    priced.filter((s) => isStale(s.prices[fuel]!.updated_at, nowMs)).map((s) => s.id),
  );

  return { ranked, unavailable: unpriced, cheapest, nearest, stale };
}
