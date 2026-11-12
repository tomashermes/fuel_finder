import { useState } from "react";
import { FUEL_LABEL, rankStations, type SearchResponse, type SortMode, type FuelKey, type Station } from "../lib/fuel.ts";
import { formatDistance } from "../lib/geo.ts";

function fmtTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown time";
  const agoH = Math.max(0, Math.round((Date.now() - t) / 3600_000));
  return `${new Date(t).toLocaleString()} (${agoH} h ago)`;
}

function directionsUrl(s: Station, origin: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${s.lat},${s.lon}&travelmode=driving`;
}

export function FuelList({
  data,
  fuel,
  sortMode,
}: {
  data: SearchResponse;
  fuel: FuelKey;
  sortMode: SortMode;
}) {
  const [showUnpriced, setShowUnpriced] = useState(false);
  const r = rankStations(data.stations, fuel, sortMode);
  const sample = !data.price_meta.live;

  return (
    <section className="fuel-list">
      <h2>
        {FUEL_LABEL[fuel]}{" "}
        <span className="count">({r.ranked.length} priced · {r.unavailable.length} without price)</span>
      </h2>

      {r.ranked.length === 0 && <p className="state">No station in range reports a price for this fuel.</p>}

      <ol>
        {r.ranked.map((s) => {
          const p = s.prices[fuel]!;
          const stale = r.stale.has(s.id);
          return (
            <li key={s.id} className={stale ? "stale" : ""}>
              <div className="head">
                <strong>{s.name}</strong>
                {s.brand && <span className="brand">{s.brand}</span>}
                {s.id === r.cheapest?.id && <span className="chip cheapest">💰 cheapest</span>}
                {s.id === r.nearest?.id && <span className="chip nearest">📍 nearest</span>}
                {stale && <span className="chip stale">⏳ stale price (&gt;24 h)</span>}
              </div>
              <div className="facts">
                <span className="price">
                  {p.price.toFixed(3)} <small>CHF/L</small>
                </span>
                <span>{formatDistance(s.distance_km)} away</span>
                {s.address && <span>{s.address}</span>}
                <span className="coords">
                  {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                </span>
              </div>
              <div className="sub">
                <span title="When this price was published/updated">Updated: {fmtTime(p.updated_at)}</span>
                {" · "}
                <span title="Where the price comes from">
                  Source: {sample ? "SAMPLE (not live)" : data.price_meta.label}
                </span>
                {" · "}
                <a href={directionsUrl(s, data.origin)} target="_blank" rel="noreferrer">
                  Directions ↗
                </a>
                {" · "}
                <a
                  href={`https://www.openstreetmap.org/${s.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Station on OpenStreetMap (location data)"
                >
                  OSM ↗
                </a>
              </div>
            </li>
          );
        })}
      </ol>

      {r.unavailable.length > 0 && (
        <div className="unpriced">
          <button className="linkish" onClick={() => setShowUnpriced((v) => !v)}>
            {showUnpriced ? "Hide" : "Show"} {r.unavailable.length} station(s) without {FUEL_LABEL[fuel]} price
          </button>
          {showUnpriced && (
            <ul>
              {r.unavailable.map((s) => (
                <li key={s.id}>
                  {s.name} — {formatDistance(s.distance_km)} — <em>price unavailable</em> (not ranked) ·{" "}
                  <a href={directionsUrl(s, data.origin)} target="_blank" rel="noreferrer">
                    Directions ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
