// AlertRepo on Supabase. Mirrors packages/db/src/json/alerts.ts.
//
// Known divergences from the JSON store: the schema has no insertion sequence, so createdAt values are
// kept strictly increasing (clock value, or newest + 1 ms when the clock has not moved past the newest
// row). Alerts list oldest first (insertion order), events newest first. The drafts of one
// addAlertEvents call get consecutive createdAt values (JSON gives them all the same one).
import type { AlertEvent } from '@homed/core';
import { RepoError, type AlertRepo } from '../repository';
import { chunks, IN_CHUNK, selectAll, unwrap, unwrapOne, WRITE_CHUNK, type SupabaseCtx } from './client';
import {
  alertEventFromRow,
  alertEventToRow,
  alertFromRow,
  alertToRow,
  isoTs,
  type AlertEventRow,
  type AlertRow,
} from './mappers';

/** The next createdAt for `table`: the clock's now, or one ms past the newest row when the clock has not moved. */
async function nextTimestamp(ctx: SupabaseCtx, table: string): Promise<string> {
  const now = ctx.now();
  const latest = unwrap(
    await ctx.sb.from(table).select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ) as { created_at: string } | null;
  if (!latest) return now;
  const last = Date.parse(isoTs(latest.created_at));
  return last < Date.parse(now) ? now : new Date(last + 1).toISOString();
}

export function alertRepo(ctx: SupabaseCtx): AlertRepo {
  const { sb } = ctx;
  return {
    listAlerts: async (userId) => {
      const rows = await selectAll<AlertRow>((f, t) =>
        sb.from('alerts').select('*').eq('user_id', userId).order('created_at').order('id').range(f, t),
      );
      return rows.map(alertFromRow);
    },

    listAllAlerts: async () => {
      const rows = await selectAll<AlertRow>((f, t) =>
        sb.from('alerts').select('*').order('created_at').order('id').range(f, t),
      );
      return rows.map(alertFromRow);
    },

    createAlert: async (input) => {
      if (input.triggers.length === 0) throw new RepoError('invalid', 'alert needs at least one trigger');
      const row = alertToRow({
        id: crypto.randomUUID(),
        userId: input.userId,
        triggers: input.triggers,
        target: input.target,
        createdAt: await nextTimestamp(ctx, 'alerts'),
      });
      const saved = unwrapOne(await sb.from('alerts').insert(row).select('*').single(), {
        invalid: 'invalid alert',
        fk: { code: 'not_found', message: 'user not found' },
      }) as AlertRow;
      return alertFromRow(saved);
    },

    deleteAlert: async (userId, alertId) => {
      unwrap(await sb.from('alerts').delete().eq('id', alertId).eq('user_id', userId));
    },

    addAlertEvents: async (drafts) => {
      if (drafts.length === 0) return [];
      const base = Date.parse(await nextTimestamp(ctx, 'alert_events'));
      const events: AlertEvent[] = drafts.map((d, i) => ({
        ...structuredClone(d),
        id: crypto.randomUUID(),
        createdAt: new Date(base + i).toISOString(),
      }));
      const saved = new Map<string, AlertEvent>();
      for (const part of chunks(events, WRITE_CHUNK)) {
        const rows = unwrap(await sb.from('alert_events').insert(part.map(alertEventToRow)).select('*'), {
          fk: { code: 'not_found', message: 'alert or user not found' },
        }) as AlertEventRow[];
        for (const r of rows) saved.set(r.id, alertEventFromRow(r));
      }
      // Draft order.
      return events.map((e) => saved.get(e.id) as AlertEvent);
    },

    listAlertEvents: async (userId, opts) => {
      const rows = await selectAll<AlertEventRow>((f, t) => {
        let q = sb.from('alert_events').select('*').eq('user_id', userId);
        if (opts?.unreadOnly) q = q.is('read_at', null);
        return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(f, t);
      });
      return rows.map(alertEventFromRow);
    },

    markAlertEventsRead: async (userId, eventIds) => {
      const now = ctx.now();
      for (const ids of chunks(eventIds, IN_CHUNK)) {
        unwrap(
          await sb.from('alert_events').update({ read_at: now }).eq('user_id', userId).in('id', ids).is('read_at', null),
        );
      }
    },
  };
}
