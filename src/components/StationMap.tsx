import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { SearchResponse } from "../lib/fuel.ts";

function icon(color: string, glyph: string) {
  return L.divIcon({
    className: "pin",
    html: `<div style="background:${color}">${glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ origin, stations }: { origin: SearchResponse["origin"]; stations: SearchResponse["stations"] }) {
  const map = useMap();
  useEffect(() => {
    const pts: L.LatLngExpression[] = [[origin.lat, origin.lon], ...stations.map((s) => [s.lat, s.lon] as L.LatLngExpression)];
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.15));
    else map.setView([origin.lat, origin.lon], 13);
  }, [origin, stations, map]);
  return null;
}

export function StationMap({ origin, stations }: { origin: SearchResponse["origin"]; stations: SearchResponse["stations"] }) {
  const originIcon = useMemo(() => icon("#2563eb", "🧭"), []);
  const stationIcons = useMemo(() => [icon("#16a34a", "⛽"), icon("#9333ea", "⛽")], []);

  return (
    <div className="map">
      <MapContainer center={[origin.lat, origin.lon]} zoom={12} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[origin.lat, origin.lon]} icon={originIcon}>
          <Popup>Selected location: {origin.label}</Popup>
        </Marker>
        {stations.map((s, i) => (
          <Marker key={s.id} position={[s.lat, s.lon]} icon={stationIcons[i % 2]}>
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {s.address ?? "—"}
              <br />
              {s.distance_km.toFixed(1)} km away
              {s.prices.super95 && <>
                <br />
                Super 95: {s.prices.super95.price.toFixed(3)} CHF/L{s.prices.super95 && !s.price_source.live ? " (sample)" : ""}
              </>}
            </Popup>
          </Marker>
        ))}
        <FitBounds origin={origin} stations={stations} />
      </MapContainer>
    </div>
  );
}
