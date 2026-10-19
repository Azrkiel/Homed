import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { effectiveRole, getCurrentUser } from '@/lib/session';
import { linksFor } from '@/components/nav-links';
import { Button, NavLink } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Homed',
  description: 'Find second-year housing near your classes: every option on and off Grounds, ranked for you.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#12161f' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const links = linksFor(user ? effectiveRole(user) : null);
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:font-medium focus:text-accent-ink"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight text-ink">
              Homed
            </Link>

            <nav
              aria-label="Main"
              className="-mx-4 order-last flex w-full min-w-0 flex-1 gap-1 overflow-x-auto px-4 text-sm md:order-none md:mx-0 md:w-auto md:px-0"
            >
              {links.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  className="shrink-0 rounded-full px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto shrink-0">
              {user ? (
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-ink hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden="true"
                      className="grid size-7 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                    >
                      {user.name.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                    <span className="sr-only max-w-40 truncate md:not-sr-only">{user.name}</span>
                  </summary>
                  <div className="absolute right-0 z-50 mt-2 grid w-48 gap-0.5 rounded-card border border-line bg-surface p-1.5 shadow-card">
                    <p className="truncate px-3 py-2 text-xs text-ink-3">{user.email}</p>
                    <Link href="/settings" className="rounded-sm px-3 py-2 text-sm text-ink hover:bg-surface-2">
                      Settings
                    </Link>
                    <Link href="/signout" className="rounded-sm px-3 py-2 text-sm text-ink hover:bg-surface-2">
                      Sign out
                    </Link>
                  </div>
                </details>
              ) : (
                <Button href="/signin" size="sm">
                  Sign in
                </Button>
              )}
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none">
          {children}
        </main>

        <footer className="mt-auto border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <p>Paid placement never changes the score.</p>
              <p>
                <a href="https://www.openstreetmap.org/copyright" className="underline underline-offset-2 hover:text-ink">
                  Map data &copy; OpenStreetMap contributors
                </a>
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/about" className="hover:text-ink">
                About
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
