import { describe, expect, it } from "vitest";
import { isStale, rankStations, type Station } from "./fuel.ts";

const src = { id: "test", label: "test source", live: true };

function station(id: string, price: number | undefined, distance: number, hoursAgo?: number): Station {
  return {
    id,
    name: `Station ${id}`,
    lat: 47.4,
    lon: 8.5,
    distance_km: distance,
    prices: price === undefined ? {} : {
      diesel: { price, updated_at: new Date(Date.now() - (hoursAgo ?? 1) * 3600_000).toISOString() },
    },
    location_source: "test",
    price_source: src,
  };
}

describe("rankStations", () => {
  const stations = [station("a", 1.95, 5), station("b", 1.85, 2), station("c", 1.85, 1), station("d", undefined, 0.2)];

  it("sorts by lowest price with distance tie-break", () => {
    const r = rankStations(stations, "diesel", "price");
    expect(r.ranked.map((s) => s.id)).toEqual(["c", "b", "a"]);
    expect(r.cheapest?.id).toBe("c");
  });

  it("sorts by nearest when mode=nearest", () => {
    const r = rankStations(stations, "diesel", "nearest");
    expect(r.ranked.map((s) => s.id)).toEqual(["c", "b", "a"]); // 1 km, 2 km, 5 km
  });

  it("never ranks stations without a price; lists them separately", () => {
    const r = rankStations(stations, "diesel", "price");
    expect(r.ranked.map((s) => s.id)).not.toContain("d");
    expect(r.unavailable.map((s) => s.id)).toEqual(["d"]);
  });

  it("nearest badge is the globally nearest station even if it has no price", () => {
    const r = rankStations(stations, "diesel", "price");
    expect(r.nearest?.id).toBe("d");
  });

  it("empty radius yields empty lists", () => {
    const r = rankStations([], "diesel", "price");
    expect(r.ranked).toEqual([]);
    expect(r.cheapest).toBeUndefined();
    expect(r.nearest).toBeUndefined();
  });
});

describe("isStale", () => {
  it("fresh within 24h", () => {
    expect(isStale(new Date(Date.now() - 10 * 3600_000).toISOString())).toBe(false);
  });
  it("stale beyond 24h", () => {
    expect(isStale(new Date(Date.now() - 25 * 3600_000).toISOString())).toBe(true);
  });
  it("unparseable timestamps count as stale", () => {
    expect(isStale("not-a-date")).toBe(true);
  });
  it("rankStations flags stale prices", () => {
    const r = rankStations([station("x", 1.5, 1, 30)], "diesel", "price");
    expect(r.stale.has("x")).toBe(true);
  });
});
