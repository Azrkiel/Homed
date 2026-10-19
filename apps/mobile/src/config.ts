// API base URL for the Homed web app that serves /api/mobile. Set EXPO_PUBLIC_API_URL to override.
const raw = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3010';

export const API_URL: string = raw.trim().replace(/\/+$/, '');
