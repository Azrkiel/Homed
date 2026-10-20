'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import type { PropertyMarker } from '@/lib/search/results';
import { money } from '@/lib/format';

const UVA_CENTER: [number, number] = [38.0336, -78.508];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** Score pill. On-Grounds pins also carry a "G" mark and a different shape (square corners), so color is never the only cue. */
function pinIcon(m: PropertyMarker): L.DivIcon {
  const label = `${m.onGrounds ? 'On Grounds, ' : ''}${m.name}, Best Match ${m.score}`;
  return L.divIcon({
    className: 'homed-pin-wrap',
    html: `<span class="homed-pin${m.onGrounds ? ' homed-pin--grounds' : ''}" aria-label="${escapeHtml(label)}">${
      m.onGrounds ? '<span class="homed-pin__mark" aria-hidden="true">G</span>' : ''
    }<span aria-hidden="true">${m.score}</span></span>`,
    iconSize: [56, 30],
    iconAnchor: [28, 15],
    popupAnchor: [0, -14],
  });
}

/** Fits the view to the markers, and re-measures when the container is shown or resized (mobile List/Map toggle). */
function MapEffects({ markers }: { markers: PropertyMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) {
      map.setView(UVA_CENTER, 14);
      return;
    }
    if (markers.length === 1) {
      const only = markers[0];
      if (only) map.setView([only.lat, only.lng], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [32, 32], maxZoom: 16 });
  }, [map, markers]);

  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function SearchMap({ markers }: { markers: PropertyMarker[] }) {
  const icons = useMemo(() => new Map(markers.map((m) => [m.propertyId, pinIcon(m)])), [markers]);
  return (
    <MapContainer
      center={UVA_CENTER}
      zoom={14}
      scrollWheelZoom
      className="size-full min-h-80"
      aria-label="Map of matching places. The list is the full, accessible view."
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <MapEffects markers={markers} />
      {markers.map((m) => (
        <Marker
          key={m.propertyId}
          position={[m.lat, m.lng]}
          icon={icons.get(m.propertyId)}
          title={`${m.name}, Best Match ${m.score}`}
          keyboard
        >
          <Popup>
            <div className="grid gap-1 text-sm">
              <strong className="text-base">{m.name}</strong>
              {m.onGrounds && <span>On Grounds</span>}
              <span>Best Match {m.score}</span>
              <span>From {money(m.fromPrice)}/person/mo all-in</span>
              <a href={m.href} className="font-medium underline underline-offset-2">
                View {m.floorPlanName}
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
