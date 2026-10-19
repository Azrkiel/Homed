'use client';
import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import type { Building, Major, ScheduleEntry } from '@homed/core';
import { Alert, Button, Card, CardBody, Field, ScrollIntoView, Select, TextInput, cx } from '@/components/ui';
import { saveClasses, type ClassesState } from '@/app/classes/actions';
import { MAX_ROWS, WEEKDAYS, looksLikeCourseNumber } from '@/lib/search/schedule-form';
import { SCHOOLS } from '@/app/settings/options';
import { BuildingPicker } from './building-picker';

interface Row {
  key: string;
  courseNumber: string;
  days: string[];
  start: string;
  end: string;
  buildingId: string;
}

function blankRow(key: string): Row {
  return { key, courseNumber: '', days: [], start: '', end: '', buildingId: '' };
}

export function ClassesForm({
  initialMode,
  initialMajorId,
  initialEntries,
  majors,
  buildings,
}: {
  initialMode: 'major' | 'schedule';
  initialMajorId: string;
  initialEntries: ScheduleEntry[];
  majors: Major[];
  buildings: Building[];
}) {
  const [state, formAction, pending] = useActionState<ClassesState | null, FormData>(saveClasses, null);
  const [mode, setMode] = useState<'major' | 'schedule'>(initialMode);
  const [majorId, setMajorId] = useState(initialMajorId);
  const nextKey = useRef(initialEntries.length + 1);
  const [rows, setRows] = useState<Row[]>(() =>
    initialEntries.length
      ? initialEntries.map((e) => ({
          key: e.id,
          courseNumber: e.courseNumber,
          days: [...e.days],
          start: e.start,
          end: e.end,
          buildingId: e.buildingId,
        }))
      : [blankRow('new-1')],
  );

  const bySchool = new Map<string, Major[]>();
  for (const m of majors) bySchool.set(m.school, [...(bySchool.get(m.school) ?? []), m]);
  const schoolLabel = (code: string) => SCHOOLS.find((s) => s.code === code)?.label ?? code;
  const schoolCodes = [...bySchool.keys()].sort((a, b) => schoolLabel(a).localeCompare(schoolLabel(b)));

  function update(key: string, patch: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    nextKey.current += 1;
    setRows((cur) => (cur.length >= MAX_ROWS ? cur : [...cur, blankRow(`new-${nextKey.current}`)]));
  }
  function removeRow(key: string) {
    setRows((cur) => cur.filter((r) => r.key !== key));
  }
  function toggleDay(key: string, day: string, on: boolean) {
    setRows((cur) =>
      cur.map((r) => (r.key === key ? { ...r, days: on ? [...new Set([...r.days, day])] : r.days.filter((d) => d !== day) } : r)),
    );
  }

  const payload = JSON.stringify(
    rows.map((r) => ({
      id: r.key.startsWith('new-') ? undefined : r.key,
      courseNumber: r.courseNumber,
      days: r.days,
      start: r.start,
      end: r.end,
      buildingId: r.buildingId,
    })),
  );
  const rowErrors = state?.errors?.rows ?? {};

  return (
    <form action={formAction} className="grid gap-6">
      {!pending && state?.ok && (
        <ScrollIntoView>
          <Alert tone="good" title="Saved">
            {state.message}{' '}
            <Link href="/search" className="font-medium text-accent underline">
              See your ranked places
            </Link>
          </Alert>
        </ScrollIntoView>
      )}
      {!pending && state && !state.ok && (
        <ScrollIntoView>
          <Alert tone="bad">{state.message}</Alert>
        </ScrollIntoView>
      )}

      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="entries" value={payload} />

      <Card as="section">
        <CardBody className="grid gap-5">
          <fieldset className="grid gap-2">
            <legend className="text-lg font-semibold text-ink">How should we find your classes?</legend>
            <div role="group" aria-label="Class entry mode" className="flex flex-wrap gap-2">
              {(
                [
                  ['major', 'By major'],
                  ['schedule', 'My schedule'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={cx(
                    'h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                    mode === value ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink hover:bg-surface-2',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-2">
              {mode === 'major'
                ? 'We estimate which buildings a typical second-year in your major visits each week.'
                : 'Enter each class with its days, times and building for exact walks.'}
            </p>
          </fieldset>

          {mode === 'major' && (
            <Field id="majorId" label="Major" error={state?.errors?.majorId}>
              {(a) => (
                <Select {...a} value={majorId} onChange={(e) => setMajorId(e.target.value)} name="majorId">
                  <option value="">Choose a major</option>
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
          )}
        </CardBody>
      </Card>

      {mode === 'schedule' && (
        <section aria-labelledby="classes-heading" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="classes-heading" className="text-lg font-semibold text-ink">
              Your classes
            </h2>
            <p className="text-sm text-ink-2">
              Course lookup (Lou&apos;s List / SIS) is not connected, so enter the building and times yourself.
            </p>
          </div>

          <ol className="grid gap-4">
            {rows.map((row, i) => {
              const n = i + 1;
              const errs = rowErrors[i] ?? {};
              const p = `row-${row.key}`;
              const courseHint =
                row.courseNumber && !looksLikeCourseNumber(row.courseNumber)
                  ? 'Usually a subject and four digits, like APMA 2120. Other codes are fine.'
                  : 'Like APMA 2120.';
              return (
                <li key={row.key}>
                  <Card>
                    <CardBody className="grid gap-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-ink">Class {n}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove class ${n}`}
                          onClick={() => removeRow(row.key)}
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field id={`${p}-course`} label={`Course number, row ${n}`} hint={courseHint} error={errs.courseNumber}>
                          {(a) => (
                            <TextInput
                              {...a}
                              value={row.courseNumber}
                              maxLength={20}
                              autoComplete="off"
                              placeholder="APMA 2120"
                              onChange={(e) => update(row.key, { courseNumber: e.target.value })}
                            />
                          )}
                        </Field>
                        <BuildingPicker
                          id={`${p}-building`}
                          label={`Building, row ${n}`}
                          buildings={buildings}
                          value={row.buildingId}
                          onChange={(buildingId) => update(row.key, { buildingId })}
                          error={errs.buildingId}
                        />
                      </div>

                      <fieldset
                        className="grid gap-2"
                        aria-describedby={errs.days ? `${p}-days-error` : undefined}
                        aria-invalid={errs.days ? true : undefined}
                      >
                        <legend className="text-sm font-medium text-ink">{`Days, row ${n}`}</legend>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAYS.map((d) => {
                            const on = row.days.includes(d.value);
                            return (
                              <label
                                key={d.value}
                                className={cx(
                                  'inline-flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                                  on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink hover:bg-surface-2',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={on}
                                  aria-label={`${d.label}, row ${n}`}
                                  onChange={(e) => toggleDay(row.key, d.value, e.target.checked)}
                                />
                                <span aria-hidden="true">{d.short}</span>
                              </label>
                            );
                          })}
                        </div>
                        {errs.days && (
                          <p id={`${p}-days-error`} className="text-sm font-medium text-bad">
                            {errs.days}
                          </p>
                        )}
                      </fieldset>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id={`${p}-start`} label={`Start time, row ${n}`} error={errs.start}>
                          {(a) => (
                            <TextInput
                              {...a}
                              type="time"
                              value={row.start}
                              onChange={(e) => update(row.key, { start: e.target.value })}
                            />
                          )}
                        </Field>
                        <Field id={`${p}-end`} label={`End time, row ${n}`} error={errs.end}>
                          {(a) => (
                            <TextInput
                              {...a}
                              type="time"
                              value={row.end}
                              min={row.start || undefined}
                              onChange={(e) => update(row.key, { end: e.target.value })}
                            />
                          )}
                        </Field>
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ol>

          <div>
            <Button variant="secondary" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
              Add a class
            </Button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={pending}>
          Save my classes
        </Button>
      </div>
    </form>
  );
}
