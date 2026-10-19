import { describe, expect, it } from 'vitest';
import { renderForSchema } from '../scripts/render-migrations';

describe('renderForSchema (sharing a Supabase project)', () => {
  it('moves tables, grants and helpers out of public and private', () => {
    const sql = [
      'create table public.users (id text);',
      'create schema if not exists private;',
      'create function private.is_admin() returns boolean language sql as $$ select true $$;',
      "create policy p on public.users using (private.is_admin());",
      'grant select on all tables in schema public to anon;',
      'revoke all on schema private from public;',
      "insert into storage.buckets (id, name, public)\nvalues ('application-docs', 'application-docs', false)\non conflict (id) do nothing;\n",
    ].join('\n');
    const out = renderForSchema(sql, 'homed');
    expect(out).toContain('create table homed.users');
    expect(out).toContain('create schema if not exists homed_private;');
    expect(out).toContain('using (homed_private.is_admin())');
    expect(out).toContain('grant select on all tables in schema homed to anon;');
    // "from public" is the PUBLIC role, not the schema: it must stay.
    expect(out).toContain('revoke all on schema homed_private from public;');
    expect(out).not.toContain('storage.buckets');
    expect(out).not.toMatch(/\bpublic\./);
  });

  it('refuses public and bad identifiers', () => {
    expect(() => renderForSchema('', 'public')).toThrow();
    expect(() => renderForSchema('', 'Homed; drop')).toThrow();
  });
});
