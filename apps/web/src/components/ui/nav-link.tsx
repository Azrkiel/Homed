'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AnchorHTMLAttributes } from 'react';
import { cx } from './cx';

export interface NavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  /** Classes added while the link matches the current path. */
  activeClassName?: string;
}

/** Link that sets aria-current="page" and `activeClassName` when its href matches the current path. */
export function NavLink({ href, className, activeClassName = 'bg-accent-soft font-medium text-accent', children, ...rest }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      {...rest}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(className, active && activeClassName)}
    >
      {children}
    </Link>
  );
}
