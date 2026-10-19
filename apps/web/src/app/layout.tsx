import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { effectiveRole, getCurrentUser } from '@/lib/session';
import { linksFor } from '@/components/nav-links';
import { NavLink } from '@/components/ui';

// Inline favicon (navy tile, orange roof): avoids a /favicon.ico 404 on every page.
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23232d4b'/%3E%3Cpath d='M16 7 6 15h3v9h14v-9h3z' fill='%23fff'/%3E%3Cpath d='M16 7 6 15h20z' fill='%23e57200'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: 'Homed',
  description: 'UVA housing, on and off Grounds, ranked for you.',
};

export const viewport: Viewport = { themeColor: '#232d4b' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const role = user ? effectiveRole(user) : null;
  const tabs = linksFor(role, 'main');
  const menu = linksFor(role, 'menu');
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={ICON} type="image/svg+xml" />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-orange focus:px-4 focus:py-2 focus:font-medium focus:text-navy"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-40 bg-navy text-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-orange" />
              Homed
            </Link>

            <nav aria-label="Main" className="-mb-px flex h-full min-w-0 flex-1 gap-1 overflow-x-auto text-sm">
              {tabs.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  className="flex shrink-0 items-center border-b-2 border-transparent px-2.5 text-white/75 hover:text-white"
                  activeClassName="border-orange font-medium text-white"
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="shrink-0">
              {user ? (
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-orange text-sm font-semibold text-navy">
                      {user.name.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                    <span className="sr-only max-w-32 truncate md:not-sr-only">{user.name}</span>
                  </summary>
                  <div className="absolute right-0 z-50 mt-2 grid w-48 gap-0.5 rounded-card border border-line bg-surface p-1 text-ink shadow-lg">
                    <p className="truncate px-3 py-2 text-xs text-ink-3">{user.email}</p>
                    {menu.map((l) => (
                      <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                        {l.label}
                      </Link>
                    ))}
                    <Link href="/settings" className="rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                      Settings
                    </Link>
                    <form action="/signout" method="post" className="border-t border-line pt-0.5">
                      <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2">
                        Sign out
                      </button>
                    </form>
                  </div>
                </details>
              ) : (
                <Link href="/signin" className="rounded-lg bg-orange px-3.5 py-1.5 text-sm font-semibold text-navy hover:brightness-105">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none">
          {children}
        </main>

        <footer className="mt-auto border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ink-3">
            <a href="https://www.openstreetmap.org/copyright" className="hover:text-ink">
              Map &copy; OpenStreetMap contributors
            </a>
            <Link href="/about" className="hover:text-ink">
              About
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
