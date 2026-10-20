// Supabase client context + PostgREST helpers shared by every Supabase area.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RepoError, systemClock, type RepoErrorCode, type StoreClock } from '../repository';

export interface SupabaseCtx {
  sb: SupabaseClient;
  /** ISO timestamp from the injected clock. */
  now(): string;
  /** 32-byte key, base64. */
  encryptionKey: string;
}

export interface CtxOptions {
  url: string;
  /** Server-side only. */
  serviceRoleKey: string;
  encryptionKey: string;
  clock?: StoreClock;
  /** Postgres schema holding Homed's tables. Default 'public'; 'homed' when sharing a project with another app. */
  schema?: string;
}

export function createCtx(opts: CtxOptions): SupabaseCtx {
  const clock = opts.clock ?? systemClock;
  const sb = createClient(opts.url, opts.serviceRoleKey, {
    db: { schema: opts.schema ?? 'public' },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClient;
  return { sb, now: () => clock.now().toISOString(), encryptionKey: opts.encryptionKey };
}

/** Shape of a PostgREST {data, error} result. */
export interface DbError {
  code?: string;
  message: string;
}
export interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

/** How to report a Postgres error the JSON store reports as a RepoError. Default message: the Postgres message. */
export interface ErrMap {
  conflict?: string;
  invalid?: string;
  /** 23503 (FK violation). Without this, a 23503 is a plain Error. */
  fk?: { code: RepoErrorCode; message: string };
}

/**
 * Postgres -> error. 23505 -> RepoError('conflict'), 23514 -> RepoError('invalid'),
 * 23503 -> RepoError(map.fk) when given. Anything else: plain Error(message).
 */
export function dbError(err: DbError, map: ErrMap = {}): Error {
  switch (err.code) {
    case '23505':
      return new RepoError('conflict', map.conflict ?? err.message);
    case '23514':
      return new RepoError('invalid', map.invalid ?? err.message);
    case '23503':
      if (map.fk) return new RepoError(map.fk.code, map.fk.message);
      return new Error(err.message);
    default:
      return new Error(err.message);
  }
}

/** Returns the data (may be null for maybeSingle misses). Throws dbError on error. */
export function unwrap<T>(res: DbResult<T>, map?: ErrMap): T | null {
  if (res.error) throw dbError(res.error, map);
  return res.data;
}

/** Returns the single row a write must produce. Throws if none came back. */
export function unwrapOne<T>(res: DbResult<T>, map?: ErrMap): T {
  const data = unwrap(res, map);
  if (data === null || data === undefined) throw new Error('expected a row, got none');
  return data;
}

/** PostgREST returns at most 1000 rows per request by default. */
export const PAGE_SIZE = 1000;

/**
 * Reads every row by paging with .range(). `page` must return an ordered query (the order must be
 * total, e.g. the primary key, or pages can skip/repeat rows).
 */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<DbResult<T[]>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = unwrap(await page(from, from + PAGE_SIZE - 1)) ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** Splits into arrays of at most n items (PostgREST .in() lists and writes stay small). */
export function chunks<T>(xs: readonly T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Max rows per upsert/insert request. */
export const WRITE_CHUNK = 500;
/** Max ids per .in() filter. */
export const IN_CHUNK = 100;
