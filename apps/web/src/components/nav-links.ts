// Site navigation. Main tabs stay few; everything else lives in the account menu.
import type { UserRole } from '@homed/core';

export interface NavLink {
  href: string;
  label: string;
  roles: UserRole[] | 'all';
  /** 'main' = header tab, 'menu' = account menu. */
  placement: 'main' | 'menu';
}

export const NAV_LINKS: NavLink[] = [
  { href: '/search', label: 'Search', roles: 'all', placement: 'main' },
  { href: '/match', label: 'Match', roles: ['student', 'admin'], placement: 'main' },
  { href: '/saved', label: 'Saved', roles: ['student', 'admin'], placement: 'main' },
  { href: '/groups', label: 'Groups', roles: ['student', 'admin'], placement: 'main' },
  { href: '/classes', label: 'Classes', roles: ['student', 'admin'], placement: 'main' },
  { href: '/landlord', label: 'Listings', roles: ['landlord', 'admin'], placement: 'main' },
  { href: '/applications', label: 'Applications', roles: ['student', 'admin'], placement: 'menu' },
  { href: '/alerts', label: 'Alerts', roles: ['student', 'admin'], placement: 'menu' },
  { href: '/compare', label: 'Compare', roles: ['student', 'admin'], placement: 'menu' },
  { href: '/admin/reviews', label: 'Moderation', roles: ['admin'], placement: 'menu' },
];

export function linksFor(role: UserRole | null, placement?: NavLink['placement']): NavLink[] {
  return NAV_LINKS.filter(
    (l) => (placement === undefined || l.placement === placement) && (l.roles === 'all' || (role !== null && l.roles.includes(role))),
  );
}
