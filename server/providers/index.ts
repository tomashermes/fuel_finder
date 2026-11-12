import { sampleProvider } from "./sample.ts";
import { createLiveProvider } from "./live.ts";
import type { PriceProvider } from "./types.ts";

export function getPriceProvider(
  env: Record<string, string | undefined> = process.env,
): PriceProvider {
  switch ((env.PRICE_PROVIDER ?? "sample").toLowerCase()) {
    case "live":
      return createLiveProvider(env);
    case "sample":
    default:
      return sampleProvider;
  }
}

export type { PriceProvider } from "./types.ts";
