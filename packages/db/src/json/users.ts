import { DEFAULT_WEIGHTS, isEmail, isStudentEmail, type User } from '@homed/core';
import { RepoError, type UserRepo } from '../repository';
import type { Ctx } from './store';

const IMMUTABLE = new Set(['id', 'email', 'role', 'createdAt']);

export function userRepo(ctx: Ctx): UserRepo {
  return {
    getUser: (id) =>
      ctx.read((s) => {
        const u = s.users.find((x) => x.id === id);
        return u ? structuredClone(u) : null;
      }),
    getUserByEmail: (email) =>
      ctx.read((s) => {
        const e = email.trim().toLowerCase();
        const u = s.users.find((x) => x.email === e);
        return u ? structuredClone(u) : null;
      }),
    createUser: (input) =>
      ctx.write((s) => {
        const email = input.email.trim().toLowerCase();
        if (input.role === 'student' ? !isStudentEmail(email) : !isEmail(email)) {
          throw new RepoError('invalid', input.role === 'student' ? 'student email must be @virginia.edu' : 'invalid email');
        }
        if (s.users.some((u) => u.email === email)) throw new RepoError('conflict', 'email already registered');
        const user: User = {
          id: crypto.randomUUID(),
          email,
          name: input.name,
          role: input.role,
          weights: { ...DEFAULT_WEIGHTS },
          extras: [],
          createdAt: ctx.now(),
        };
        s.users.push(user);
        return structuredClone(user);
      }),
    updateUser: (id, patch) =>
      ctx.write((s) => {
        const user = s.users.find((x) => x.id === id);
        if (!user) throw new RepoError('not_found', `user ${id} not found`);
        const target = user as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
          if (IMMUTABLE.has(k)) continue;
          if (v === undefined) delete target[k];
          else target[k] = structuredClone(v);
        }
        return structuredClone(user);
      }),
    getSchedule: (userId) =>
      ctx.read((s) => {
        const x = s.schedules.find((e) => e.userId === userId);
        return x ? structuredClone(x) : null;
      }),
    saveSchedule: (schedule) =>
      ctx.write((s) => {
        const stored = { ...structuredClone(schedule), updatedAt: ctx.now() };
        const i = s.schedules.findIndex((e) => e.userId === schedule.userId);
        if (i >= 0) s.schedules[i] = stored;
        else s.schedules.push(stored);
        return structuredClone(stored);
      }),
  };
}
