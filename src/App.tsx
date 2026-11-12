import { useCallback, useEffect, useRef, useState } from "react";
import { geocode, stations as fetchStations } from "./api.ts";
import type { SearchResponse, SortMode } from "./lib/fuel.ts";
import { FuelList } from "./components/FuelList.tsx";
import { StationMap } from "./components/StationMap.tsx";

const DEFAULT_ADDRESS = "Oerlikon, Zürich, Switzerland";

type Status = "idle" | "loading" | "ready" | "error" | "empty";

export default function App() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const [origin, setOrigin] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [geoNote, setGeoNote] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bootRef = useRef(false);

  const runSearch = useCallback(async (lat: number, lon: number, label: string, radius: number) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    setError("");
    try {
      const res = await fetchStations(lat, lon, radius, label);
      setData(res);
      setOrigin({ lat, lon, label });
      setStatus(res.station_count === 0 ? "empty" : "ready");
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  const submitAddress = useCallback(
    async (addr: string) => {
      setStatus("loading");
      setError("");
      setGeoNote("");
      try {
        const g = await geocode(addr);
        setGeoNote(`Geocoded via ${g.source}: ${g.result.display_name}`);
        await runSearch(g.result.lat, g.result.lon, g.result.display_name, radiusKm);
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    },
    [radiusKm, runSearch],
  );

  // initial search with the prefilled address (once)
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    void submitAddress(DEFAULT_ADDRESS);
  }, [submitAddress]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("This browser does not provide geolocation.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGeoNote("Using your GPS position (browser geolocation).");
        void runSearch(latitude, longitude, `My location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`, radiusKm);
      },
      (err) => {
        setError(`Location unavailable: ${err.message}`);
        setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const sampleMode = data ? !data.price_meta.live : false;

  return (
    <div className="wrap">
      <header>
        <h1>⛽ Fuel stations near Zürich</h1>
        <p className="sub">
          Station locations from OpenStreetMap (live) · prices via pluggable provider · distances &amp;
          rankings computed locally
        </p>
      </header>

      {sampleMode && (
        <div className="badge-sample" role="alert">
          ⚠️ SAMPLE DATA — NOT LIVE. {data?.price_meta.note ?? ""}
        </div>
      )}

      <section className="controls">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitAddress(address);
          }}
        >
          <label htmlFor="addr">Address</label>
          <div className="row">
            <input
              id="addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Schaffhauserstrasse 100, 8050 Zürich"
            />
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Searching…" : "Find stations"}
            </button>
            <button type="button" onClick={useMyLocation} disabled={status === "loading"}>
              📍 Use my current location
            </button>
          </div>
        </form>

        <div className="row meta-row">
          <label>
            Radius{" "}
            <select
              value={radiusKm}
              onChange={(e) => {
                const r = Number(e.target.value);
                setRadiusKm(r);
                if (origin) void runSearch(origin.lat, origin.lon, origin.label, r);
              }}
            >
              {[2, 5, 10, 15, 20, 25].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by{" "}
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
              <option value="price">lowest price</option>
              <option value="nearest">nearest</option>
            </select>
          </label>
          {origin && (
            <span className="coords" title="Resolved WGS84 coordinates of the selected location">
              🌐 {origin.lat.toFixed(5)}, {origin.lon.toFixed(5)}
            </span>
          )}
        </div>
        {geoNote && <p className="note">{geoNote}</p>}
      </section>

      {status === "loading" && <div className="state">Loading stations…</div>}
      {status === "error" && (
        <div className="state error">
          ✗ {error}{" "}
          <button onClick={() => (origin ? runSearch(origin.lat, origin.lon, origin.label, radiusKm) : submitAddress(address))}>
            Retry
          </button>
        </div>
      )}
      {status === "empty" && (
        <div className="state">No fuel stations found within {radiusKm} km of the selected location. Try a larger radius.</div>
      )}

      {data && (status === "ready" || status === "empty") && (
        <>
          <p className="note">
            {data.station_count} stations within {data.radius_km} km · location data:{" "}
            {data.location_meta.provider}
            {data.location_meta.osm_base_timestamp ? ` (OSM base ${data.location_meta.osm_base_timestamp})` : ""} · prices:{" "}
            <strong>{data.price_meta.label}</strong>
          </p>

          <StationMap origin={data.origin} stations={data.stations} />

          <div className="lists">
            <FuelList data={data} fuel="super95" sortMode={sortMode} />
            <FuelList data={data} fuel="diesel" sortMode={sortMode} />
            {data.stations.some((s) => s.prices.super98 !== undefined) && (
              <FuelList data={data} fuel="super98" sortMode={sortMode} />
            )}
          </div>
        </>
      )}

      <footer>
        <p>
          © OpenStreetMap contributors (stations via Overpass; geocoding via Nominatim) · Map tiles ©{" "}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors. Prices in CHF per litre.
          Not affiliated with any fuel price service.
        </p>
      </footer>
    </div>
  );
}
