// Map picker geometry shared by the client picker. Pure.
export const UVA_CENTER: [number, number] = [38.0336, -78.508];

/** Coordinates from a click or a typed number, rounded to ~0.1 m (6 decimals). */
export function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** True for finite lat/lng inside the world bounds. Empty strings are not coordinates. */
export function isValidLatLng(lat: string, lng: string): boolean {
  if (lat.trim() === '' || lng.trim() === '') return false;
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180;
}
