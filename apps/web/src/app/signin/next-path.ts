const BACKSLASH = String.fromCharCode(92);

/** `next` must be a same-site relative path: starts with "/" but not "//" or "/" + backslash. Anything else -> "/search". */
export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string') return '/search';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/' + BACKSLASH)) return '/search';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) return '/search';
  }
  return raw;
}
