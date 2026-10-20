'use client';
// Client-only Leaflet map for the property editor. Loaded with next/dynamic ssr:false by location-picker.tsx.
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { UVA_CENTER, roundCoord } from '@/lib/landlord/location';

interface Props {
  lat?: number;
  lng?: number;
  onPick: (lat: number, lng: number) => void;
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(roundCoord(e.latlng.lat), roundCoord(e.latlng.lng));
    },
  });
  return null;
}

export default function LocationMap({ lat, lng, onPick }: Props) {
  const hasPin = lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng);
  return (
    <MapContainer
      center={UVA_CENTER}
      zoom={15}
      scrollWheelZoom
      className="size-full min-h-72"
      aria-label="Map. Click to place the property. Typed coordinates below work too."
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <ClickToPick onPick={onPick} />
      {hasPin && (
        <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 0.8 }} />
      )}
    </MapContainer>
  );
}
