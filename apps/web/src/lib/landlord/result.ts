// Shared state type for landlord forms (useActionState). Kept out of actions.ts: 'use server' files export only async functions.
export type LandlordActionState = { ok: true; message: string } | { ok: false; message: string } | null;
