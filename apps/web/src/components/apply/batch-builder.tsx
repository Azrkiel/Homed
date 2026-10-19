'use client';
// Batch builder: ranked places, solo or group, roommates, guarantors, live fee summary.
// The initial render comes from the URL (works without JS); reorder, add, remove and live totals need JS.
import { useActionState, useState } from 'react';
import { APPLY_IS_NOT_SIGNING, MAX_BATCH_SIZE, type FeeQuote } from '@homed/core';
import { Alert, Button, Card, CardBody, Field, ScrollIntoView, Select, TextInput } from '@/components/ui';
import { moneyPrecise } from '@/lib/format';
import { reorder } from '@/lib/apply/batch';
import { createBatch, type BatchState } from '@/lib/apply/batch-actions';
import { buildFeeSummary, guarantorOptions, padRows, type BuilderPlace } from './batch-logic';

const ROW_MIN = 4;
const MAX_ROOMMATES = 7;
const ORDINAL = ['1st', '2nd', '3rd'];

interface Guarantor {
  email: string;
  name: string;
  forEmail: string;
}

export interface BatchBuilderProps {
  initialPlaces: BuilderPlace[];
  savedOptions: BuilderPlace[];
  leaderEmail: string;
  groups: { id: string; name: string }[];
  /** Roommate emails (leader removed) for each group the student is in. */
  groupRoommates: Record<string, string[]>;
  initialGroupId: string;
  initialRoommates: string[];
}

function blankGuarantors(n: number): Guarantor[] {
  return Array.from({ length: n }, () => ({ email: '', name: '', forEmail: '' }));
}

export function BatchBuilder({
  initialPlaces,
  savedOptions,
  leaderEmail,
  groups,
  groupRoommates,
  initialGroupId,
  initialRoommates,
}: BatchBuilderProps) {
  const [places, setPlaces] = useState<BuilderPlace[]>(initialPlaces);
  const [groupId, setGroupId] = useState(initialGroupId);
  const [roommates, setRoommates] = useState<string[]>(initialRoommates);
  const [guarantors, setGuarantors] = useState<Guarantor[]>(() => blankGuarantors(ROW_MIN));
  const [savedPick, setSavedPick] = useState('');
  const [state, formAction, pending] = useActionState<BatchState, FormData>(createBatch, {});

  const summary = buildFeeSummary(places, roommates);
  const options = guarantorOptions(leaderEmail, roommates);
  const addable = savedOptions.filter((s) => !places.some((p) => p.floorPlanId === s.floorPlanId));
  const canAddPlace = places.length < MAX_BATCH_SIZE;

  function pickGroup(id: string) {
    setGroupId(id);
    setRoommates(padRows(id === '' ? [] : (groupRoommates[id] ?? []), ROW_MIN));
  }

  function updateRoommate(i: number, value: string) {
    setRoommates((list) => list.map((v, j) => (j === i ? value : v)));
  }

  function updateGuarantor(i: number, patch: Partial<Guarantor>) {
    setGuarantors((list) => list.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  }

  function addSaved() {
    const pick = savedOptions.find((s) => s.floorPlanId === savedPick);
    if (!pick || !canAddPlace || places.some((p) => p.floorPlanId === pick.floorPlanId)) return;
    setPlaces((list) => [...list, pick]);
    setSavedPick('');
  }

  return (
    <div className="grid gap-6">
      {/* Group picker: a GET form so it works without JS. With JS the state changes in place. */}
      <form method="get" action="/apply/new" className="grid gap-3">
        {places.map((p) => (
          <input key={p.floorPlanId} type="hidden" name="fp" value={p.floorPlanId} />
        ))}
        <Field id="group-pick" label="Apply as" hint={groups.length === 0 ? 'Create or join a group to apply with roommates.' : undefined}>
          {(a) => (
            <Select {...a} name="group" value={groupId} disabled={groups.length === 0} onChange={(e) => pickGroup(e.target.value)}>
              <option value="">Just me</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Group: {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <noscript>
          <Button type="submit" variant="secondary" size="sm">
            Load group
          </Button>
        </noscript>
      </form>

      <form action={formAction} className="grid gap-6">
        {state.error && (
          <ScrollIntoView>
            <Alert tone="bad" title="Could not send">
              {state.error}
            </Alert>
          </ScrollIntoView>
        )}

        <input type="hidden" name="groupId" value={groupId} />

        {/* Places */}
        <Card as="section">
          <CardBody className="grid gap-4">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-ink">Places, in order of preference</h2>
              <p className="text-sm text-ink-2">Up to {MAX_BATCH_SIZE}. Your first choice is listed first.</p>
            </div>
            {places.length === 0 ? (
              <p className="text-sm text-ink-2">No places yet. Add one from your saved list.</p>
            ) : (
              <ol className="grid gap-2">
                {places.map((p, i) => (
                  <li
                    key={p.floorPlanId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line bg-surface-2 px-3 py-2"
                  >
                    <input type="hidden" name="fp" value={p.floorPlanId} />
                    <span className="min-w-0 text-sm text-ink">
                      <span className="text-ink-2">{ORDINAL[i] ?? `${i + 1}th`} choice: </span>
                      <span className="font-medium">{p.label}</span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" disabled={i === 0} aria-label={`Move ${p.label} up`} onClick={() => setPlaces((l) => reorder(l, i, i - 1))}>
                        Up
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={i === places.length - 1}
                        aria-label={`Move ${p.label} down`}
                        onClick={() => setPlaces((l) => reorder(l, i, i + 1))}
                      >
                        Down
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${p.label}`}
                        onClick={() => setPlaces((l) => l.filter((x) => x.floorPlanId !== p.floorPlanId))}
                      >
                        Remove
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {canAddPlace && addable.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field id="saved-pick" label="Add from saved">
                  {(a) => (
                    <Select {...a} value={savedPick} onChange={(e) => setSavedPick(e.target.value)}>
                      <option value="">Choose a saved place</option>
                      {addable.map((s) => (
                        <option key={s.floorPlanId} value={s.floorPlanId}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button type="button" variant="secondary" disabled={savedPick === ''} onClick={addSaved}>
                  Add place
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Roommates */}
        <Card as="section">
          <CardBody className="grid gap-4">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-ink">Roommates</h2>
              <p className="text-sm text-ink-2">
                Each roommate gets an invite and fills in their own part. Each applicant pays their own application fees.
              </p>
            </div>
            <div className="grid gap-3">
              {roommates.map((email, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field id={`roommate-${i}`} label={`Roommate ${i + 1} email`}>
                    {(a) => (
                      <TextInput
                        {...a}
                        type="email"
                        name="roommate"
                        value={email}
                        onChange={(e) => updateRoommate(i, e.target.value)}
                        placeholder="name@virginia.edu"
                        maxLength={200}
                        autoComplete="off"
                      />
                    )}
                  </Field>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRoommates((l) => l.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={roommates.length >= MAX_ROOMMATES}
                onClick={() => setRoommates((l) => [...l, ''])}
              >
                Add roommate
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Guarantors */}
        <Card as="section">
          <CardBody className="grid gap-4">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-ink">Guarantors (optional)</h2>
              <p className="text-sm text-ink-2">
                A guarantor pays nothing and does not need an account. They get an invite to sign their part.
              </p>
            </div>
            {guarantors.map((g, n) => (
              <div key={n} className="grid gap-3 rounded-sm border border-line p-3 sm:grid-cols-3">
                <Field id={`guarantor-email-${n}`} label={`Guarantor ${n + 1} email`}>
                  {(a) => (
                    <TextInput
                      {...a}
                      type="email"
                      name={`guarantorEmail_${n}`}
                      value={g.email}
                      onChange={(e) => updateGuarantor(n, { email: e.target.value })}
                      maxLength={200}
                      autoComplete="off"
                    />
                  )}
                </Field>
                <Field id={`guarantor-name-${n}`} label="Name">
                  {(a) => (
                    <TextInput
                      {...a}
                      name={`guarantorName_${n}`}
                      value={g.name}
                      onChange={(e) => updateGuarantor(n, { name: e.target.value })}
                      maxLength={120}
                      autoComplete="off"
                    />
                  )}
                </Field>
                <Field id={`guarantor-for-${n}`} label="Guarantees">
                  {(a) => (
                    <Select
                      {...a}
                      name={`guarantorFor_${n}`}
                      value={options.includes(g.forEmail) ? g.forEmail : ''}
                      onChange={(e) => updateGuarantor(n, { forEmail: e.target.value })}
                    >
                      <option value="">Choose a person</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Fees */}
        <section aria-labelledby="fees-heading" className="grid gap-4">
          <h2 id="fees-heading" className="text-lg font-semibold text-ink">
            Fees
          </h2>
          {places.length === 0 ? (
            <p className="text-sm text-ink-2">Add a place to see its fees.</p>
          ) : (
            summary.places.map((p) => <FeeCard key={p.floorPlanId} label={p.label} quote={p.quote} />)
          )}

          {summary.warnings.map((w) => (
            <Alert key={`${w.floorPlanId}-${w.message}`} tone="warn" title={`Check the fees for ${w.label}`}>
              {w.message} You can still apply. Ask the landlord about it.
            </Alert>
          ))}

          {places.length > 0 && (
            <Card as="section">
              <CardBody className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="grid gap-1">
                  <p className="text-sm text-ink-2">
                    Batch total for {summary.people} {summary.people === 1 ? 'person' : 'people'}, {places.length}{' '}
                    {places.length === 1 ? 'place' : 'places'}
                  </p>
                  <p className="text-xs text-ink-3">Guarantors pay nothing.</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-ink">{moneyPrecise(summary.total)}</p>
              </CardBody>
            </Card>
          )}

          <div className="grid gap-1 text-sm text-ink-2">
            <p>Fees are paid to the landlord directly for now.</p>
            <p>{APPLY_IS_NOT_SIGNING}</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending} disabled={places.length === 0}>
            {places.length === 0 ? 'Add a place to apply' : `Send ${places.length === 1 ? 'application' : `${places.length} applications`}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FeeCard({ label, quote }: { label: string; quote: FeeQuote }) {
  return (
    <Card as="section">
      <CardBody className="grid gap-3">
        <h3 className="font-semibold text-ink">{label}</h3>
        <table className="w-full text-sm">
          <caption className="sr-only">Fees for {label}</caption>
          <tbody>
            {quote.perPerson.length === 0 && (
              <tr>
                <td className="py-2 text-ink-2">No application fees listed.</td>
              </tr>
            )}
            {quote.perPerson.map((line) => (
              <tr key={line.label} className="border-t border-line first:border-t-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">
                  {line.label} <span className="text-xs text-ink-3">{line.refundable ? '(refundable)' : '(nonrefundable)'}</span>
                </th>
                <td className="py-2 text-right tabular-nums text-ink">{moneyPrecise(line.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold">
              <th scope="row" className="py-2 pr-3 text-left">
                Per person
              </th>
              <td className="py-2 text-right tabular-nums">{moneyPrecise(quote.perPersonTotal)}</td>
            </tr>
            <tr className="font-semibold">
              <th scope="row" className="py-2 pr-3 text-left">
                For {quote.people} {quote.people === 1 ? 'person' : 'people'}
              </th>
              <td className="py-2 text-right tabular-nums">{moneyPrecise(quote.applicationTotal)}</td>
            </tr>
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
