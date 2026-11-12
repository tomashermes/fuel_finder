import { describe, expect, it } from "vitest";
import { haversineKm, formatDistance } from "./geo.ts";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    const p = { lat: 47.4086, lon: 8.5479 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 10);
  });

  it("computes ~111.2 km for one degree of latitude at the equator", () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.19, 1);
  });

  it("matches known Swiss distance: Zürich Hauptbahnhof → Bern (approx 95 km straight-line)", () => {
    const zh = { lat: 47.3782, lon: 8.5387 };
    const be = { lat: 46.948, lon: 7.4474 };
    const d = haversineKm(zh, be);
    expect(d).toBeGreaterThan(88);
    expect(d).toBeLessThan(102);
  });

  it("is symmetric", () => {
    const a = { lat: 47.4086, lon: 8.5479 };
    const b = { lat: 47.3769, lon: 8.5415 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 8);
  });

  it("formats distances", () => {
    expect(formatDistance(0.456)).toBe("456 m");
    expect(formatDistance(3.1415)).toBe("3.1 km");
  });
});
