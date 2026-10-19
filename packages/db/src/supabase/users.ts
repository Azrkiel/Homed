// UserRepo on Supabase. Mirrors packages/db/src/json/users.ts (validation, messages, immutable fields).
import { DEFAULT_WEIGHTS, isEmail, isStudentEmail, type User, type UserSchedule } from '@homed/core';
import { RepoError, type NewUser, type UserRepo } from '../repository';
import { unwrap, unwrapOne, type SupabaseCtx } from './client';
import {
  scheduleFromRow,
  scheduleToRow,
  userFromRow,
  userToRow,
  type UserRow,
  type UserScheduleRow,
} from './mappers';

const IMMUTABLE = new Set(['id', 'email', 'role', 'createdAt']);

export function userRepo(ctx: SupabaseCtx): UserRepo {
  const { sb } = ctx;
  return {
    getUser: async (id) => {
      const row = unwrap(await sb.from('users').select('*').eq('id', id).maybeSingle()) as UserRow | null;
      return row ? userFromRow(row) : null;
    },

    getUserByEmail: async (email) => {
      const row = unwrap(
        await sb.from('users').select('*').eq('email', email.trim().toLowerCase()).maybeSingle(),
      ) as UserRow | null;
      return row ? userFromRow(row) : null;
    },

    createUser: async (input: NewUser): Promise<User> => {
      const email = input.email.trim().toLowerCase();
      if (input.role === 'student' ? !isStudentEmail(email) : !isEmail(email)) {
        throw new RepoError('invalid', input.role === 'student' ? 'student email must be @virginia.edu' : 'invalid email');
      }
      const user: User = {
        id: crypto.randomUUID(),
        email,
        name: input.name,
        role: input.role,
        weights: { ...DEFAULT_WEIGHTS },
        extras: [],
        createdAt: ctx.now(),
      };
      const row = unwrapOne(
        await sb.from('users').insert(userToRow(user)).select('*').single(),
        { conflict: 'email already registered' },
      ) as UserRow;
      return userFromRow(row);
    },

    updateUser: async (id, patch) => {
      const current = unwrap(await sb.from('users').select('*').eq('id', id).maybeSingle()) as UserRow | null;
      if (!current) throw new RepoError('not_found', `user ${id} not found`);
      // Same rules as the JSON store: immutable keys are ignored, `undefined` clears an optional field.
      const p = Object.fromEntries(Object.entries(patch).filter(([k]) => !IMMUTABLE.has(k))) as typeof patch;
      const row: Partial<UserRow> = {};
      if (p.name !== undefined) row.name = p.name;
      if ('classYear' in p) row.class_year = p.classYear ?? null;
      if ('school' in p) row.school = p.school ?? null;
      if ('majorId' in p) row.major_id = p.majorId ?? null;
      if ('budgetMax' in p) row.budget_max = p.budgetMax ?? null;
      if (p.weights !== undefined) {
        row.weight_price = p.weights.price;
        row.weight_location = p.weights.location;
        row.weight_looks = p.weights.looks;
      }
      if (p.extras !== undefined) row.extras = [...p.extras];
      if (Object.keys(row).length === 0) return userFromRow(current);
      const updated = unwrapOne(
        await sb.from('users').update(row).eq('id', id).select('*').single(),
      ) as UserRow;
      return userFromRow(updated);
    },

    getSchedule: async (userId) => {
      const row = unwrap(
        await sb.from('user_schedules').select('*').eq('user_id', userId).maybeSingle(),
      ) as UserScheduleRow | null;
      return row ? scheduleFromRow(row) : null;
    },

    saveSchedule: async (schedule: Omit<UserSchedule, 'updatedAt'>): Promise<UserSchedule> => {
      const row = unwrapOne(
        await sb
          .from('user_schedules')
          .upsert(scheduleToRow(schedule, ctx.now()), { onConflict: 'user_id' })
          .select('*')
          .single(),
        { fk: { code: 'not_found', message: `user ${schedule.userId} not found` } },
      ) as UserScheduleRow;
      return scheduleFromRow(row);
    },
  };
}
