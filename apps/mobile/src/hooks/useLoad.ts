// Loads data on mount and whenever deps change. Exposes reload, optimistic setData and error text.
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiError } from '../api';

export interface LoadState<T> {
  data: T | null;
  error: string | null;
  /** True during the first load and during reloads (data stays visible). */
  loading: boolean;
  reload: () => void;
  setData: Dispatch<SetStateAction<T | null>>;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Something went wrong.';
}

export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[] = []): LoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    load().then(
      (next) => {
        if (!active) return;
        setData(next);
        setLoading(false);
      },
      (e: unknown) => {
        if (!active) return;
        setError(errorText(e));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
    // The caller's deps decide when to reload; load itself is intentionally not a dependency.
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, reload, setData };
}
