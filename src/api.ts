import type { SearchResponse } from "./lib/fuel.ts";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      msg = `${msg} (no JSON body from ${url}) — the local API server is probably not running; start it with "npm run dev"`;
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function geocode(q: string): Promise<{ result: { lat: number; lon: number; display_name: string }; source: string }> {
  return getJSON(`/api/geocode?q=${encodeURIComponent(q)}`);
}

export function stations(lat: number, lon: number, radiusKm: number, label: string): Promise<SearchResponse> {
  const p = new URLSearchParams({ lat: String(lat), lon: String(lon), r: String(radiusKm), label });
  return getJSON(`/api/stations?${p}`);
}
