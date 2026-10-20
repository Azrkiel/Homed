'use client';
import { useActionState } from 'react';
import { Button, Field, TextInput } from '@/components/ui';
import { confirmAvailabilityAction } from '@/lib/landlord/actions';
import { FormAlert } from './form-alert';

/** Weekly check: confirms the unit count and resets the freshness clock. Form names: propertyId, floorPlanId, unitsAvailable (blank = unknown). */
export function ConfirmAvailabilityForm({
  propertyId,
  floorPlanId,
  floorPlanName,
  unitsValue,
}: {
  propertyId: string;
  floorPlanId: string;
  floorPlanName: string;
  unitsValue: string;
}) {
  const [state, action, pending] = useActionState(confirmAvailabilityAction, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="floorPlanId" value={floorPlanId} />
      <Field id={`avail-${floorPlanId}`} label={`Units available, ${floorPlanName}`} hint="Blank if unknown.">
        {(c) => (
          <TextInput
            {...c}
            name="unitsAvailable"
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            defaultValue={unitsValue}
          />
        )}
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        Confirm availability
      </Button>
      <div className="sm:col-span-2">
        <FormAlert state={state} />
      </div>
    </form>
  );
}
