import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-bad text-accent-ink hover:brightness-95',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and blocks activation. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };

export type ButtonLinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href' | 'onClick'> & { href: string };

function classes(variant: ButtonVariant, size: ButtonSize, fullWidth: boolean, className?: string) {
  return cx(BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className);
}

/** <button> by default; pass `href` to render a next/link anchor styled as a button. */
export function Button(props: ButtonProps | ButtonLinkProps) {
  if (typeof props.href === 'string') return <ButtonLink {...props} href={props.href} />;
  return <NativeButton {...props} />;
}

function NativeButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes(variant, size, fullWidth, className)}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  // No onClick wrapper: this module is a server-friendly component, and functions cannot cross into it.
  // aria-disabled + pointer-events-none stops activation while loading.
  return (
    <Link
      {...rest}
      href={href}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={classes(variant, size, fullWidth, className)}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </Link>
  );
}
