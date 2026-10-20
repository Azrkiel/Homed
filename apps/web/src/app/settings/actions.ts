'use server';
import { revalidatePath } from 'next/cache';
import { normalizeWeights, type ClassYear } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { fromPercent } from '@/lib/search/weights';
import { CLASS_YEARS, SCHOOLS } from './options';

export interface SettingsState {
  saved?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<'name' | 'classYear' | 'school' | 'majorId' | 'budgetMax', string>>;
}

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function pctValue(fd: FormData, key: string): number {
  const n = Number(text(fd, key));
  return Number.isFinite(n) ? n : 0;
}

function failure(e: unknown): SettingsState {
  return { error: e instanceof RepoError ? e.message : 'Could not save your settings. Please try again.' };
}

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser(undefined, '/settings');
  const isStudent = effectiveRole(user) !== 'landlord';
  const fieldErrors: NonNullable<SettingsState['fieldErrors']> = {};

  const name = text(formData, 'name');
  if (!name) fieldErrors.name = 'Enter your name.';
  else if (name.length > 80) fieldErrors.name = 'Keep your name under 80 characters.';

  if (!isStudent) {
    if (Object.keys(fieldErrors).length) return { fieldErrors };
    try {
      await getRepo().updateUser(user.id, { name });
    } catch (e) {
      return failure(e);
    }
    revalidatePath('/', 'layout');
    return { saved: true };
  }

  const classYearRaw = text(formData, 'classYear');
  let classYear: ClassYear | undefined;
  if (classYearRaw) {
    const found = CLASS_YEARS.find((c) => c.value === classYearRaw);
    if (found) classYear = found.value;
    else fieldErrors.classYear = 'Choose a class year from the list.';
  }

  const schoolRaw = text(formData, 'school');
  let school: string | undefined;
  if (schoolRaw) {
    if (SCHOOLS.some((s) => s.code === schoolRaw)) school = schoolRaw;
    else fieldErrors.school = 'Choose a school from the list.';
  }

  const repo = getRepo();
  const majorRaw = text(formData, 'majorId');
  let majorId: string | undefined;
  let extras: string[] = [];
  try {
    if (majorRaw) {
      const majors = await repo.listMajors();
      if (majors.some((m) => m.id === majorRaw)) majorId = majorRaw;
      else fieldErrors.majorId = 'Choose a major from the list.';
    }
    const known = new Set((await repo.listLandmarks()).map((l) => l.id));
    const picked = formData.getAll('extras').filter((v): v is string => typeof v === 'string');
    extras = [...new Set(picked)].filter((id) => known.has(id));
  } catch (e) {
    return failure(e);
  }

  const budgetRaw = text(formData, 'budgetMax').replace(/[$,\s]/g, '');
  let budgetMax: number | undefined;
  if (budgetRaw) {
    const n = Number(budgetRaw);
    if (!Number.isFinite(n) || n <= 0) fieldErrors.budgetMax = 'Enter a monthly budget above $0, or leave it blank.';
    else if (n > 100_000) fieldErrors.budgetMax = 'That budget looks too high. Enter a monthly amount.';
    else budgetMax = Math.round(n);
  }

  const weights = normalizeWeights(
    fromPercent({
      price: pctValue(formData, 'price'),
      location: pctValue(formData, 'location'),
      looks: pctValue(formData, 'looks'),
    }),
  );

  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    await repo.updateUser(user.id, { name, classYear, school, majorId, budgetMax, weights, extras });
  } catch (e) {
    return failure(e);
  }
  revalidatePath('/', 'layout');
  return { saved: true };
}
