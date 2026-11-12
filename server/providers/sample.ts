/** SAMPLE price provider — deterministic, clearly labelled, NOT live.
 *
 *  Generates stable pseudo-prices from each station's OSM id so results are
 *  reproducible between reloads. Timestamps are synthetic (mostly "today",
 *  some deliberately >24 h old to exercise the stale-price UI).
 *
 *  Nothing here is a real price. The UI must always show the
 *  "SAMPLE DATA — NOT LIVE" badge while this provider is active.
 */
import type { FuelKey, PriceInfo } from "../../src/lib/fuel.ts";
import type { PriceProvider } from "./types.ts";

/** Realistic CHF/L bands (order of magnitude only — NOT a price claim). */
const BANDS: Record<FuelKey, [number, number]> = {
  super95: [1.79, 1.99],
  diesel: [1.92, 2.19],
  super98: [1.89, 2.12],
};

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sampleProvider: PriceProvider = {
  meta: {
    id: "sample",
    label: "SAMPLE DATA — NOT LIVE (synthetic demo prices)",
    live: false,
    note:
      "No free public per-station price API exists for Switzerland. " +
      "Prices below are synthetic and reproducible — see README to connect a real provider.",
  },
  async getPrices(stations) {
    const out: Record<string, Partial<Record<FuelKey, PriceInfo>>> = {};
    const now = Date.now();
    for (const st of stations) {
      const r = rand(hash(st.id));
      const prices: Partial<Record<FuelKey, PriceInfo>> = {};
      const put = (fuel: FuelKey, present: boolean, ageBias: number) => {
        if (!present) return;
        const [lo, hi] = BANDS[fuel];
        const price = Math.round((lo + r() * (hi - lo)) * 1000) / 1000;
        const ageH = ageBias + r() * 6; // hours
        prices[fuel] = {
          price,
          updated_at: new Date(now - ageH * 3600_000).toISOString(),
        };
      };
      // ~85% have Super 95, ~80% diesel, ~20% Super 98; a few stale (>24 h)
      put("super95", r() < 0.85, r() < 0.15 ? 25 : 1);
      put("diesel", r() < 0.8, r() < 0.15 ? 26 : 2);
      put("super98", r() < 0.2, 3);
      out[st.id] = prices;
    }
    return out;
  },
};
