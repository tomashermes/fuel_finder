/** Price provider adapter.
 *
 *  The app never hard-codes prices into the UI: everything comes through a
 *  StationPriceProvider. To connect a real Swiss price feed later, implement
 *  this interface in a new file and register it in providers/index.ts.
 *
 *  Swiss reality (verified 2026-11): there is NO free public per-station
 *  price API for Switzerland. Tankerkönig (the German open-data API) covers
 *  Germany only. Station-level prices in CH live in commercial products
 *  (e.g. tankbillig.ch B2B, TCS, HERE) that require a contract/key.
 *  Hence: sample provider by default, live provider behind env config.
 */
import type { FuelKey, PriceInfo, PriceSourceMeta } from "../../src/lib/fuel.ts";

export interface PriceProvider {
  meta: PriceSourceMeta;
  /** Return prices for the given stations (keyed by station id).
   *  Missing fuel => no price; providers must NOT invent prices. */
  getPrices(
    stations: { id: string }[],
  ): Promise<Record<string, Partial<Record<FuelKey, PriceInfo>>>>;
}
