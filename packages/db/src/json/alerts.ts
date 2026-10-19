import type { Alert, AlertEvent } from '@homed/core';
import { RepoError, type AlertRepo } from '../repository';
import type { Ctx } from './store';

export function alertRepo(ctx: Ctx): AlertRepo {
  return {
    listAlerts: (userId) => ctx.read((s) => structuredClone(s.alerts.filter((a) => a.userId === userId))),
    listAllAlerts: () => ctx.read((s) => structuredClone(s.alerts)),
    createAlert: (input) =>
      ctx.write((s) => {
        if (input.triggers.length === 0) throw new RepoError('invalid', 'alert needs at least one trigger');
        const alert: Alert = {
          id: crypto.randomUUID(),
          userId: input.userId,
          triggers: structuredClone(input.triggers),
          target: structuredClone(input.target),
          createdAt: ctx.now(),
        };
        s.alerts.push(alert);
        return structuredClone(alert);
      }),
    deleteAlert: (userId, alertId) =>
      ctx.write((s) => {
        s.alerts = s.alerts.filter((a) => !(a.id === alertId && a.userId === userId));
      }),
    addAlertEvents: (drafts) =>
      ctx.write((s) => {
        const now = ctx.now();
        const out: AlertEvent[] = drafts.map((d) => ({
          ...structuredClone(d),
          id: crypto.randomUUID(),
          createdAt: now,
        }));
        s.alertEvents.push(...out);
        return structuredClone(out);
      }),
    listAlertEvents: (userId, opts) =>
      ctx.read((s) => {
        const rows = s.alertEvents
          .filter((e) => e.userId === userId && !(opts?.unreadOnly && e.readAt !== undefined))
          .reverse();
        rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
        return structuredClone(rows);
      }),
    markAlertEventsRead: (userId, eventIds) =>
      ctx.write((s) => {
        const ids = new Set(eventIds);
        const now = ctx.now();
        for (const e of s.alertEvents) {
          if (e.userId === userId && ids.has(e.id) && e.readAt === undefined) e.readAt = now;
        }
      }),
  };
}
