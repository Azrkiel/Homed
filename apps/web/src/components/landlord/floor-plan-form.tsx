'use client';
import { useActionState, useState } from 'react';
import type { FloorPlan } from '@homed/core';
import { Alert, Button, Checkbox, Field, Select, TextInput } from '@/components/ui';
import { deleteFloorPlanAction, saveFloorPlanAction } from '@/lib/landlord/actions';
import { feeWarnings } from '@/lib/landlord/fee-warnings';
import { FormAlert } from './form-alert';

type FeeField = 'applicationFee' | 'screeningCost' | 'applicationDeposit' | 'securityDeposit';

function feeNumber(s: string): number | undefined {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Floor plan editor (create when `floorPlan` is absent). Form names: propertyId, floorPlanId (edit),
 * name, beds, baths, sqft, rentAmount, rentBasis (per_bed | per_unit), leaseStart, leaseEnd,
 * termKind (12_month | academic_year | semester | other), leaseType (individual | joint),
 * furnished, furnitureMonthly, utilitiesIncluded, utilitiesEstimate, internetIncluded, internetEstimate,
 * inUnitLaundry, dishwasher, ac, unitsAvailable, totalUnits, applicationFee, screeningCost,
 * applicationDeposit, securityDeposit, floorPlanImageUrl.
 */
export function FloorPlanForm({ propertyId, floorPlan }: { propertyId: string; floorPlan?: FloorPlan }) {
  const [state, action, pending] = useActionState(saveFloorPlanAction, null);
  const p = floorPlan?.id ?? 'new';
  const [fees, setFees] = useState<Record<FeeField, string>>({
    applicationFee: floorPlan?.applicationFee?.toString() ?? '',
    screeningCost: floorPlan?.screeningCost?.toString() ?? '',
    applicationDeposit: floorPlan?.applicationDeposit?.toString() ?? '',
    securityDeposit: floorPlan?.securityDeposit?.toString() ?? '',
  });
  // Same rule the student quote uses (quoteFees via feeWarnings), recomputed on every keystroke.
  const warnings = feeWarnings({
    applicationFee: feeNumber(fees.applicationFee),
    screeningCost: feeNumber(fees.screeningCost),
    applicationDeposit: feeNumber(fees.applicationDeposit),
    securityDeposit: feeNumber(fees.securityDeposit),
  });
  const feeInput = (field: FeeField, label: string, hint?: string) => (
    <Field id={`fp-${p}-${field}`} label={label} hint={hint}>
      {(c) => (
        <TextInput
          {...c}
          name={field}
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          value={fees[field]}
          onChange={(e) => setFees((f) => ({ ...f, [field]: e.target.value }))}
        />
      )}
    </Field>
  );
  const id = (name: string) => `fp-${p}-${name}`;

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="propertyId" value={propertyId} />
      {floorPlan && <input type="hidden" name="floorPlanId" value={floorPlan.id} />}
      <FormAlert state={state} />

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-ink">Unit</legend>
        <Field id={id('name')} label="Floor plan name" required hint='For example "2BR / 2BA" or "Studio A".'>
          {(c) => <TextInput {...c} name="name" required maxLength={200} defaultValue={floorPlan?.name} />}
        </Field>
        <Field id={id('beds')} label="Bedrooms" required hint="0 for a studio.">
          {(c) => <TextInput {...c} name="beds" type="number" inputMode="numeric" min={0} max={20} required defaultValue={floorPlan?.beds} />}
        </Field>
        <Field id={id('baths')} label="Bathrooms" required hint="Multiples of 0.5.">
          {(c) => <TextInput {...c} name="baths" type="number" step={0.5} min={0} max={20} required defaultValue={floorPlan?.baths} />}
        </Field>
        <Field id={id('sqft')} label="Square feet">
          {(c) => <TextInput {...c} name="sqft" type="number" inputMode="numeric" min={1} max={100000} defaultValue={floorPlan?.sqft} />}
        </Field>
        <Field id={id('totalUnits')} label="Total units of this plan">
          {(c) => <TextInput {...c} name="totalUnits" type="number" inputMode="numeric" min={1} max={1000} defaultValue={floorPlan?.totalUnits} />}
        </Field>
        <Field id={id('unitsAvailable')} label="Units available now" hint="Leave blank if unknown.">
          {(c) => (
            <TextInput {...c} name="unitsAvailable" type="number" inputMode="numeric" min={0} max={1000} defaultValue={floorPlan?.unitsAvailable ?? ''} />
          )}
        </Field>
        <Field id={id('floorPlanImageUrl')} label="Floor plan image URL" className="sm:col-span-2">
          {(c) => <TextInput {...c} name="floorPlanImageUrl" type="url" placeholder="https://" maxLength={2000} defaultValue={floorPlan?.floorPlanImageUrl} />}
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-ink">Rent and lease</legend>
        <Field id={id('rentAmount')} label="Rent (USD per month)" required>
          {(c) => <TextInput {...c} name="rentAmount" type="number" inputMode="numeric" min={0} max={100000} required defaultValue={floorPlan?.rentAmount} />}
        </Field>
        <Field id={id('rentBasis')} label="Rent is" required hint="Per bed: the rent is for one person. Per unit: the rent is split by bedrooms.">
          {(c) => (
            <Select {...c} name="rentBasis" defaultValue={floorPlan?.rentBasis ?? 'per_unit'}>
              <option value="per_unit">Per unit</option>
              <option value="per_bed">Per bed</option>
            </Select>
          )}
        </Field>
        <Field id={id('leaseStart')} label="Lease start" required>
          {(c) => <TextInput {...c} name="leaseStart" type="date" required defaultValue={floorPlan?.leaseStart} />}
        </Field>
        <Field id={id('leaseEnd')} label="Lease end" required>
          {(c) => <TextInput {...c} name="leaseEnd" type="date" required defaultValue={floorPlan?.leaseEnd} />}
        </Field>
        <Field id={id('termKind')} label="Lease term" required>
          {(c) => (
            <Select {...c} name="termKind" defaultValue={floorPlan?.termKind ?? '12_month'}>
              <option value="12_month">12 months</option>
              <option value="academic_year">Academic year</option>
              <option value="semester">Semester</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>
        <Field id={id('leaseType')} label="Lease type" required>
          {(c) => (
            <Select {...c} name="leaseType" defaultValue={floorPlan?.leaseType ?? 'individual'}>
              <option value="individual">Individual leases</option>
              <option value="joint">Joint lease</option>
            </Select>
          )}
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-ink">Included and features</legend>
        <Checkbox id={id('furnished')} name="furnished" label="Furnished" defaultChecked={floorPlan?.furnished} />
        <Checkbox id={id('utilitiesIncluded')} name="utilitiesIncluded" label="Utilities included" defaultChecked={floorPlan?.utilitiesIncluded} />
        <Checkbox id={id('internetIncluded')} name="internetIncluded" label="Internet included" defaultChecked={floorPlan?.internetIncluded} />
        <Checkbox id={id('inUnitLaundry')} name="inUnitLaundry" label="In-unit laundry" defaultChecked={floorPlan?.inUnitLaundry} />
        <Checkbox id={id('dishwasher')} name="dishwasher" label="Dishwasher" defaultChecked={floorPlan?.dishwasher} />
        <Checkbox id={id('ac')} name="ac" label="Air conditioning" defaultChecked={floorPlan?.ac} />
        <Field id={id('furnitureMonthly')} label="Furniture rental per person, per month (USD)">
          {(c) => <TextInput {...c} name="furnitureMonthly" type="number" inputMode="numeric" min={0} max={100000} defaultValue={floorPlan?.furnitureMonthly} />}
        </Field>
        <Field id={id('utilitiesEstimate')} label="Utilities estimate per person, per month (USD)">
          {(c) => <TextInput {...c} name="utilitiesEstimate" type="number" inputMode="numeric" min={0} max={100000} defaultValue={floorPlan?.utilitiesEstimate} />}
        </Field>
        <Field id={id('internetEstimate')} label="Internet estimate per person, per month (USD)">
          {(c) => <TextInput {...c} name="internetEstimate" type="number" inputMode="numeric" min={0} max={100000} defaultValue={floorPlan?.internetEstimate} />}
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold text-ink">Fees (per person, USD)</legend>
        <div className="sm:col-span-2">
          {warnings.length > 0 ? (
            <Alert tone="warn" title="Check these fees">
              <ul className="grid list-disc gap-1 pl-5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <p className="text-sm text-ink-2">Virginia caps nonrefundable application fees at $50. Screening is passed through at actual cost.</p>
          )}
        </div>
        {feeInput('applicationFee', 'Application fee (nonrefundable)', 'Virginia limit: $50 per person.')}
        {feeInput('screeningCost', 'Screening cost (actual third-party cost)')}
        {feeInput('applicationDeposit', 'Application deposit (refundable)')}
        {feeInput('securityDeposit', 'Security deposit')}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {floorPlan ? 'Save floor plan' : 'Add floor plan'}
        </Button>
      </div>
    </form>
  );
}

/** Removes one floor plan (and, through the repo, its availability record). Parent gives the confirm wording. */
export function DeleteFloorPlanForm({ propertyId, floorPlanId, name }: { propertyId: string; floorPlanId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteFloorPlanAction, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="floorPlanId" value={floorPlanId} />
      <FormAlert state={state} />
      <div>
        <Button type="submit" variant="danger" size="sm" loading={pending} aria-label={`Delete floor plan ${name}`}>
          Delete floor plan
        </Button>
      </div>
    </form>
  );
}
