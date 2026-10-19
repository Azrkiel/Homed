'use client';
import { useActionState, useState } from 'react';
import { WEIGHT_PRESETS, type ClassYear, type Landmark, type Major, type ScoreWeights, type WeightPreset } from '@homed/core';
import { Alert, Button, Card, CardBody, Checkbox, CheckboxGroup, Field, ScrollIntoView, Select, TextInput, cx } from '@/components/ui';
import { rebalance, toPercent, type PercentWeights, type WeightKey } from '@/lib/search/weights';
import { saveSettings, type SettingsState } from './actions';
import { CLASS_YEARS, LANDMARK_KIND_LABELS, SCHOOLS } from './options';

export interface SettingsFormUser {
  name: string;
  email: string;
  classYear?: ClassYear;
  school?: string;
  majorId?: string;
  budgetMax?: number;
  weights: ScoreWeights;
  extras: string[];
}

const SLIDERS: { key: WeightKey; label: string; hint: string }[] = [
  { key: 'price', label: 'Price', hint: 'Lower all-in monthly cost scores higher.' },
  { key: 'location', label: 'Location', hint: 'Shorter walks to your classes and picked places score higher.' },
  { key: 'looks', label: 'Looks', hint: 'Better-rated photos score higher.' },
];

const PRESETS = Object.entries(WEIGHT_PRESETS) as [WeightPreset, (typeof WEIGHT_PRESETS)[WeightPreset]][];

export function SettingsForm({
  user,
  isStudent,
  majors,
  landmarks,
}: {
  user: SettingsFormUser;
  isStudent: boolean;
  majors: Major[];
  landmarks: Landmark[];
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [pct, setPct] = useState<PercentWeights>(() => toPercent(user.weights));
  const fe = state.fieldErrors ?? {};

  const activePreset = PRESETS.find(([, p]) => {
    const t = toPercent(p.weights);
    return t.price === pct.price && t.location === pct.location && t.looks === pct.looks;
  })?.[0];

  const schoolLabel = (code: string) => SCHOOLS.find((s) => s.code === code)?.label ?? code;
  const bySchool = new Map<string, Major[]>();
  for (const m of majors) bySchool.set(m.school, [...(bySchool.get(m.school) ?? []), m]);
  const schoolCodes = [...bySchool.keys()].sort((a, b) => schoolLabel(a).localeCompare(schoolLabel(b)));

  const kindLabel = (k: string) => LANDMARK_KIND_LABELS[k] ?? k;
  const byKind = new Map<string, Landmark[]>();
  for (const l of landmarks) byKind.set(l.kind, [...(byKind.get(l.kind) ?? []), l]);
  const kinds = [...byKind.keys()].sort((a, b) => kindLabel(a).localeCompare(kindLabel(b)));

  return (
    <form action={formAction} className="grid gap-6">
      {!pending && state.saved && (
        <ScrollIntoView>
          <Alert tone="good" title="Saved">
            Your settings are updated. Rankings now use them.
          </Alert>
        </ScrollIntoView>
      )}
      {!pending && state.error && (
        <ScrollIntoView>
          <Alert tone="bad">{state.error}</Alert>
        </ScrollIntoView>
      )}

      <Card as="section">
        <CardBody className="grid gap-5">
          <h2 className="text-lg font-semibold text-ink">About you</h2>
          <Field id="name" label="Name" required error={fe.name} hint={`Signed in as ${user.email}.`}>
            {(a) => <TextInput {...a} name="name" autoComplete="name" defaultValue={user.name} maxLength={80} />}
          </Field>

          {isStudent && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="classYear" label="Class year" error={fe.classYear}>
                  {(a) => (
                    <Select {...a} name="classYear" defaultValue={user.classYear ?? ''}>
                      <option value="">Not set</option>
                      {CLASS_YEARS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field id="school" label="School" error={fe.school}>
                  {(a) => (
                    <Select {...a} name="school" defaultValue={user.school ?? ''}>
                      <option value="">Not set</option>
                      {SCHOOLS.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field id="majorId" label="Major" hint="Used to estimate which buildings your classes are in." error={fe.majorId}>
                {(a) => (
                  <Select {...a} name="majorId" defaultValue={user.majorId ?? ''}>
                    <option value="">Not set</option>
                    {schoolCodes.map((code) => (
                      <optgroup key={code} label={schoolLabel(code)}>
                        {(bySchool.get(code) ?? []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                id="budgetMax"
                label="Max budget per month"
                hint="All-in monthly cost per person, in dollars. Leave blank for no budget."
                error={fe.budgetMax}
              >
                {(a) => (
                  <TextInput
                    {...a}
                    name="budgetMax"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={10}
                    placeholder="No budget"
                    defaultValue={user.budgetMax ?? ''}
                  />
                )}
              </Field>
            </>
          )}
        </CardBody>
      </Card>

      {!isStudent && (
        <Alert tone="info">Weights and extras are student features. Landlord accounts only have a name to edit.</Alert>
      )}

      {isStudent && (
        <>
          <Card as="section">
            <CardBody>
              <fieldset className="grid gap-5">
                <legend className="mb-2 text-lg font-semibold text-ink">What matters most</legend>
                <p className="text-sm text-ink-2">
                  Best Match blends price, location and looks. The three always add up to 100%.
                </p>

                <div role="group" aria-label="Weight presets" className="flex flex-wrap gap-2">
                  {PRESETS.map(([id, p]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={activePreset === id}
                      onClick={() => setPct(toPercent(p.weights))}
                      className={cx(
                        'h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                        activePreset === id
                          ? 'border-accent bg-accent text-accent-ink'
                          : 'border-line bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-5">
                  {SLIDERS.map((s) => (
                    <div key={s.key} className="grid gap-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor={`w-${s.key}`} className="text-sm font-medium text-ink">
                          {s.label}
                        </label>
                        <output htmlFor={`w-${s.key}`} className="text-sm font-semibold tabular-nums text-ink">
                          {pct[s.key]}%
                        </output>
                      </div>
                      <input
                        id={`w-${s.key}`}
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={pct[s.key]}
                        aria-describedby={`w-${s.key}-hint`}
                        aria-valuetext={`${pct[s.key]} percent`}
                        onChange={(e) => setPct((cur) => rebalance(cur, s.key, Number(e.target.value)))}
                        className="h-2 w-full cursor-pointer accent-accent"
                      />
                      <p id={`w-${s.key}-hint`} className="text-sm text-ink-2">
                        {s.hint}
                      </p>
                    </div>
                  ))}
                </div>
                <input type="hidden" name="price" value={pct.price} />
                <input type="hidden" name="location" value={pct.location} />
                <input type="hidden" name="looks" value={pct.looks} />
              </fieldset>
            </CardBody>
          </Card>

          <Card as="section">
            <CardBody className="grid gap-5">
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold text-ink">Extras</h2>
                <p className="text-sm text-ink-2">Places you want close by. They count toward your location score.</p>
              </div>
              {landmarks.length === 0 ? (
                <p className="text-sm text-ink-2">No places to pick yet.</p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {kinds.map((kind) => (
                    <CheckboxGroup key={kind} id={`extras-${kind}`} legend={kindLabel(kind)}>
                      {(byKind.get(kind) ?? []).map((l) => (
                        <Checkbox
                          key={l.id}
                          id={`extra-${l.id}`}
                          name="extras"
                          value={l.id}
                          label={l.name}
                          defaultChecked={user.extras.includes(l.id)}
                        />
                      ))}
                    </CheckboxGroup>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
