'use client';
import { useId, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ACCESSIBILITY_FEATURE_LABELS, countActiveFilters, type AccessibilityFeature, type ListingFilters, type WeightPreset } from '@homed/core';
import { Button, Checkbox, Field, Select, Sheet, TextInput } from '@/components/ui';
import { searchHref } from '@/lib/search/href';
import type { SortKey } from '@/lib/search/params';

type BoolKey = {
  [K in keyof ListingFilters]-?: NonNullable<ListingFilters[K]> extends boolean ? K : never;
}[keyof ListingFilters];

const A11Y = Object.keys(ACCESSIBILITY_FEATURE_LABELS) as AccessibilityFeature[];

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-b border-line pb-5 last:border-b-0">
      <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** "Filters (N)" button plus the Sheet with every ListingFilters field. Apply navigates; sort and preset are kept. */
export function FilterDrawer({
  filters,
  sort,
  preset,
}: {
  filters: ListingFilters;
  sort: SortKey;
  preset: WeightPreset | null;
}) {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ListingFilters>(filters);
  const count = countActiveFilters(filters);

  function openDrawer() {
    setDraft(filters);
    setOpen(true);
  }
  function go(next: ListingFilters) {
    setOpen(false);
    router.push(searchHref(next, { sort, preset }));
  }
  function patch(p: Partial<Record<keyof ListingFilters, unknown>>) {
    const next: Record<string, unknown> = { ...draft };
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined || v === false || v === '') delete next[k];
      else next[k] = v;
    }
    setDraft(next as ListingFilters);
  }

  const id = (name: string) => `${uid}-${name}`;
  const bool = (key: BoolKey, label: string, hint?: string) => (
    <Checkbox
      key={key}
      id={id(key)}
      label={label}
      hint={hint}
      checked={draft[key] === true}
      onChange={(e) => patch({ [key]: e.target.checked })}
    />
  );
  const numberValue = (n: number | undefined) => (n === undefined ? '' : String(n));
  const parseNumber = (raw: string) => (raw.trim() === '' || !Number.isFinite(Number(raw)) ? undefined : Number(raw));

  return (
    <>
      <Button variant="secondary" onClick={openDrawer} aria-haspopup="dialog">
        Filters{count > 0 ? ` (${count})` : ''}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Filters${count > 0 ? ` (${count} active)` : ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => go({})}>
              Clear all
            </Button>
            <Button onClick={() => go(draft)}>Show results</Button>
          </>
        }
      >
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            go(draft);
          }}
        >
          <Group legend="Budget & size">
            <Field id={id('max')} label="Max cost per person" hint="All-in monthly, in dollars.">
              {(a) => (
                <TextInput
                  {...a}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  value={numberValue(draft.maxCostPerPerson)}
                  onChange={(e) => patch({ maxCostPerPerson: parseNumber(e.target.value) })}
                />
              )}
            </Field>
            <Field id={id('size')} label="Group size" hint="Matches places with exactly this many bedrooms. A studio counts as 1.">
              {(a) => (
                <TextInput
                  {...a}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={numberValue(draft.groupSize)}
                  onChange={(e) => {
                    const n = parseNumber(e.target.value);
                    patch({ groupSize: n !== undefined && Number.isInteger(n) && n >= 1 ? n : undefined });
                  }}
                />
              )}
            </Field>
            {bool('privateBathroom', 'Private bathroom', 'One bathroom per bedroom.')}
          </Group>

          <Group legend="Lease">
            <Field id={id('lease')} label="Lease type">
              {(a) => (
                <Select {...a} value={draft.leaseType ?? ''} onChange={(e) => patch({ leaseType: e.target.value })}>
                  <option value="">Any</option>
                  <option value="individual">Individual</option>
                  <option value="joint">Joint</option>
                </Select>
              )}
            </Field>
            <Field id={id('term')} label="Lease term">
              {(a) => (
                <Select {...a} value={draft.termKind ?? ''} onChange={(e) => patch({ termKind: e.target.value })}>
                  <option value="">Any</option>
                  <option value="12_month">12 months</option>
                  <option value="academic_year">Academic year</option>
                  <option value="semester">Semester</option>
                  <option value="other">Other</option>
                </Select>
              )}
            </Field>
            <Field id={id('movein')} label="Move in by" hint="Lease must start on or before this date.">
              {(a) => (
                <TextInput {...a} type="date" value={draft.moveInBy ?? ''} onChange={(e) => patch({ moveInBy: e.target.value })} />
              )}
            </Field>
            {bool('studyAbroadFriendly', 'Study-abroad friendly', 'Subletting allowed or a semester option exists.')}
            {bool('noGuarantorNeeded', 'No guarantor needed')}
          </Group>

          <Group legend="Unit">
            {bool('furnished', 'Furnished')}
            {bool('utilitiesIncluded', 'Utilities included')}
            {bool('inUnitLaundry', 'In-unit laundry')}
            {bool('dishwasher', 'Dishwasher')}
            {bool('ac', 'Air conditioning')}
          </Group>

          <Group legend="Building">
            <Field id={id('noise')} label="Noise level">
              {(a) => (
                <Select {...a} value={draft.noise ?? ''} onChange={(e) => patch({ noise: e.target.value })}>
                  <option value="">Any</option>
                  <option value="quiet">Quiet</option>
                  <option value="social">Social</option>
                </Select>
              )}
            </Field>
            <Field id={id('grounds')} label="On or off Grounds">
              {(a) => (
                <Select {...a} value={draft.onGrounds ?? ''} onChange={(e) => patch({ onGrounds: e.target.value })}>
                  <option value="">Both</option>
                  <option value="only">On Grounds only</option>
                  <option value="exclude">Off Grounds only</option>
                </Select>
              )}
            </Field>
            {bool('amenityBuilding', 'Gym, study rooms or rooftop')}
            {bool('petsAllowed', 'Pets allowed')}
          </Group>

          <Group legend="Getting around">
            {bool('onBusRoute', 'On a bus route')}
            {bool('parkingAvailable', 'Parking available')}
            {bool('litRoute', 'Lit route to Grounds')}
          </Group>

          <Group legend="Accessibility">
            {bool('accommodationFriendly', 'Accommodation-friendly', 'Has an accommodation contact and process on file.')}
            <p className="text-sm text-ink-2">Must have all of these features:</p>
            {A11Y.map((f) => (
              <Checkbox
                key={f}
                id={id(`a11y-${f}`)}
                label={ACCESSIBILITY_FEATURE_LABELS[f]}
                checked={draft.accessibilityFeatures?.includes(f) ?? false}
                onChange={(e) => {
                  const current = draft.accessibilityFeatures ?? [];
                  const next = e.target.checked ? [...new Set([...current, f])] : current.filter((x) => x !== f);
                  patch({ accessibilityFeatures: next.length > 0 ? next : undefined });
                }}
              />
            ))}
          </Group>

          <Group legend="Grad">
            {bool('studioOr1Br', 'Studio or 1 bedroom')}
            {bool('gradHeavy', 'Grad-heavy building')}
          </Group>

          {/* Lets Enter submit from the number and date fields. */}
          <button type="submit" className="sr-only" tabIndex={-1}>
            Show results
          </button>
        </form>
      </Sheet>
    </>
  );
}
