'use client';
// Address -> lat/lng without geocoding: click the map to set the pin, or type the numbers. Both stay in sync.
// Posts hidden inputs named lat and lng. The visible number inputs have no name, so FormData has one value each.
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Field, Skeleton, TextInput } from '@/components/ui';
import { isValidLatLng, UVA_CENTER } from '@/lib/landlord/location';

const LocationMap = dynamic(() => import('./location-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});

interface Pos {
  lat: string;
  lng: string;
}

export function LocationPicker({ lat, lng }: { lat?: number; lng?: number }) {
  const [pos, setPos] = useState<Pos>({
    lat: lat !== undefined ? String(lat) : '',
    lng: lng !== undefined ? String(lng) : '',
  });
  const valid = isValidLatLng(pos.lat, pos.lng);
  const mapLat = valid ? Number(pos.lat) : undefined;
  const mapLng = valid ? Number(pos.lng) : undefined;

  return (
    <div className="grid gap-3">
      <input type="hidden" name="lat" value={pos.lat} readOnly />
      <input type="hidden" name="lng" value={pos.lng} readOnly />
      <div className="h-72 overflow-hidden rounded-card border border-line">
        <LocationMap
          lat={mapLat}
          lng={mapLng}
          onPick={(la, ln) => setPos({ lat: String(la), lng: String(ln) })}
        />
      </div>
      <p className="text-sm text-ink-2">
        {valid
          ? `Pin at ${Number(pos.lat).toFixed(5)}, ${Number(pos.lng).toFixed(5)}.`
          : `No pin yet. Click the map near the building (centered on Charlottesville at ${UVA_CENTER[0]}, ${UVA_CENTER[1]}).`}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field id="loc-lat" label="Latitude" required>
          {(a) => (
            <TextInput
              {...a}
              type="number"
              inputMode="decimal"
              step="any"
              min={-90}
              max={90}
              value={pos.lat}
              onChange={(e) => setPos((p) => ({ ...p, lat: e.target.value }))}
            />
          )}
        </Field>
        <Field id="loc-lng" label="Longitude" required>
          {(a) => (
            <TextInput
              {...a}
              type="number"
              inputMode="decimal"
              step="any"
              min={-180}
              max={180}
              value={pos.lng}
              onChange={(e) => setPos((p) => ({ ...p, lng: e.target.value }))}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
