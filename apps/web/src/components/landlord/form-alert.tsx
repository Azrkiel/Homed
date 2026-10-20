import { Alert } from '@/components/ui';
import type { LandlordActionState } from '@/lib/landlord/result';

/** Result of the last landlord server action in this form. Errors are announced; success is polite. */
export function FormAlert({ state }: { state: LandlordActionState }) {
  if (!state) return null;
  return state.ok ? <Alert tone="good">{state.message}</Alert> : <Alert tone="bad">{state.message}</Alert>;
}
