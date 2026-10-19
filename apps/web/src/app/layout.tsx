import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { effectiveRole, getCurrentUser } from '@/lib/session';
import { linksFor } from '@/components/nav-links';

export const metadata: Metadata = {
  title: 'Homed',
  description: 'Find second-year housing near your classes: every option on and off Grounds, ranked for you.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const links = linksFor(user ? effectiveRole(user) : null);
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Homed
            </Link>
            <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-ink">
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="text-sm">
              {user ? (
                <Link href="/settings" className="text-ink-2 hover:text-ink">
                  {user.name}
                </Link>
              ) : (
                <Link href="/signin" className="rounded-full bg-accent px-3 py-1.5 font-medium text-accent-ink">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
