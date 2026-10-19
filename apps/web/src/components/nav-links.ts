// Site navigation. CONTRACT (Phase 0, lead-owned): every phase's top-level route is listed here up front.
import type { UserRole } from '@homed/core';

export interface NavLink {
  href: string;
  label: string;
  roles: UserRole[] | 'all';
}

export const NAV_LINKS: NavLink[] = [
  { href: '/search', label: 'Search', roles: 'all' },
  { href: '/match', label: 'Match', roles: ['student', 'admin'] },
  { href: '/compare', label: 'Compare', roles: ['student', 'admin'] },
  { href: '/classes', label: 'My Classes', roles: ['student', 'admin'] },
  { href: '/groups', label: 'Groups', roles: ['student', 'admin'] },
  { href: '/saved', label: 'Saved', roles: ['student', 'admin'] },
  { href: '/applications', label: 'Applications', roles: ['student', 'admin'] },
  { href: '/alerts', label: 'Alerts', roles: ['student', 'admin'] },
  { href: '/landlord', label: 'Landlord', roles: ['landlord', 'admin'] },
  { href: '/admin/reviews', label: 'Moderation', roles: ['admin'] },
];

export function linksFor(role: UserRole | null): NavLink[] {
  return NAV_LINKS.filter((l) => l.roles === 'all' || (role !== null && l.roles.includes(role)));
}
