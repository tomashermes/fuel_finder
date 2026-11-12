/** LIVE price provider — INTEGRATION POINT, intentionally not implemented.
 *
 *  To go live you need a contracted Swiss station-price feed. Known options
 *  (as of 2026-11, none free/self-serve for CH):
 *   - tankbillig.ch B2B data licensing (https://en.tankbillig.ch/werben-und-b2b,
 *     contact/sales required)
 *   - TCS / other commercial price services
 *   - HERE Fuel Prices API (verify Swiss coverage with HERE before use; key required)
 *
 *  Implement getPrices() against your chosen provider. Keep the API key
 *  server-side in .env (see .env.example) — never expose it to the browser.
 */
import type { PriceProvider } from "./types.ts";

export function createLiveProvider(env: Record<string, string | undefined>): PriceProvider {
  const key = env.TANKBILLIG_API_KEY ?? env.FUEL_PRICE_API_KEY;
  return {
    meta: {
      id: "live",
      label: "Live station prices (configured provider)",
      live: true,
    },
    async getPrices() {
      if (!key) {
        const err = new Error(
          "PRICE_PROVIDER=live is set but no API key is configured. " +
            "Set TANKBILLIG_API_KEY / FUEL_PRICE_API_KEY in .env and implement " +
            "server/providers/live.ts for your provider.",
        );
        (err as Error & { statusCode?: number }).statusCode = 501;
        throw err;
      }
      throw new Error(
        "Live provider skeleton: implement the fetch/merge logic for your " +
          "contracted price feed in server/providers/live.ts.",
      );
    },
  };
}
