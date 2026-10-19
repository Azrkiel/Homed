'use server';
import { revalidatePath } from 'next/cache';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { parseRowsJson, validateScheduleRows, type RowErrors } from '@/lib/search/schedule-form';

export interface ClassesState {
  ok: boolean;
  message: string;
  errors?: { majorId?: string; rows?: Record<number, RowErrors> };
}

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/** Saves the user's schedule (major or manual entries) and refreshes every page that ranks by it. */
export async function saveClasses(_prev: ClassesState | null, formData: FormData): Promise<ClassesState> {
  const user = await requireUser(undefined, '/classes');
  const mode = text(formData, 'mode') === 'schedule' ? 'schedule' : 'major';
  const repo = getRepo();

  try {
    if (mode === 'major') {
      const majorId = text(formData, 'majorId');
      if (!majorId) {
        return { ok: false, message: 'Choose your major to save.', errors: { majorId: 'Choose a major from the list.' } };
      }
      const majors = await repo.listMajors();
      if (!majors.some((m) => m.id === majorId)) {
        return { ok: false, message: 'Choose your major to save.', errors: { majorId: 'Choose a major from the list.' } };
      }
      await repo.saveSchedule({ userId: user.id, mode: 'major', majorId, entries: [] });
      if (user.majorId !== majorId) await repo.updateUser(user.id, { majorId });
    } else {
      const rows = parseRowsJson(text(formData, 'entries'));
      if (rows === null) return { ok: false, message: 'Could not read your classes. Reload the page and try again.' };
      const buildingIds = new Set((await repo.listBuildings()).map((b) => b.id));
      const parsed = validateScheduleRows(rows, buildingIds);
      if (!parsed.ok) return { ok: false, message: parsed.message, errors: { rows: parsed.rowErrors } };
      const existing = await repo.getSchedule(user.id);
      await repo.saveSchedule({
        userId: user.id,
        mode: 'schedule',
        majorId: existing?.majorId ?? user.majorId,
        entries: parsed.entries,
      });
    }
  } catch (e) {
    if (e instanceof RepoError) return { ok: false, message: e.message || 'Could not save your classes. Please try again.' };
    return { ok: false, message: 'Could not save your classes. Please try again.' };
  }

  revalidatePath('/classes');
  revalidatePath('/search');
  revalidatePath('/match');
  revalidatePath('/saved');
  revalidatePath('/settings');
  revalidatePath('/listings/[floorPlanId]', 'page');
  return { ok: true, message: 'Saved. Rankings now use your classes.' };
}
