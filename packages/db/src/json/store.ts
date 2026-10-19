import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadSeed } from '@homed/data';
import { systemClock } from '../repository';
import type { JsonStoreOptions } from './index';
import { stateFromSeed, type State } from './state';

/** Shared access to the in-memory state. Every operation runs through one serial queue. */
export interface Ctx {
  /** Run a read-only operation; the result must already be a copy or primitive. */
  read<T>(fn: (s: State) => T): Promise<T>;
  /** Run a mutating operation, then persist. Validate before mutating. */
  write<T>(fn: (s: State) => T): Promise<T>;
  now(): string;
  encryptionKey: string;
}

export function createCtx(opts: JsonStoreOptions): Ctx {
  const clock = opts.clock ?? systemClock;
  const file = opts.filePath;
  let state: State | null = null;
  let loadedMtime = 0;
  let queue: Promise<unknown> = Promise.resolve();

  function mtime(): number {
    try {
      return statSync(file as string).mtimeMs;
    } catch {
      return 0;
    }
  }

  function persist(s: State): void {
    if (!file) return;
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(s));
    renameSync(tmp, file);
    loadedMtime = mtime();
  }

  function ensureLoaded(): State {
    if (!file) {
      state ??= stateFromSeed(opts.seed ?? loadSeed());
      return state;
    }
    const m = mtime();
    if (state === null || m > loadedMtime) {
      if (m === 0) {
        state = stateFromSeed(opts.seed ?? loadSeed());
        persist(state);
      } else {
        state = JSON.parse(readFileSync(file, 'utf8')) as State;
        loadedMtime = m;
      }
    }
    return state;
  }

  function run<T>(fn: (s: State) => T, persistAfter: boolean): Promise<T> {
    const next = queue.then(() => {
      const s = ensureLoaded();
      const out = fn(s);
      if (persistAfter) persist(s);
      return out;
    });
    queue = next.catch(() => undefined);
    return next;
  }

  return {
    read: (fn) => run(fn, false),
    write: (fn) => run(fn, true),
    now: () => clock.now().toISOString(),
    encryptionKey: opts.encryptionKey,
  };
}
