import type { ReactNode } from 'react';
import { cx } from './cx';

/** Surface container. Compose with CardHeader / CardBody / CardFooter for slots. */
export function Card({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: 'div' | 'section' | 'article';
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cx('rounded-card border border-line bg-surface shadow-card', className)}>{children}</Tag>;
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('border-b border-line px-5 py-4', className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-3 border-t border-line bg-surface-2 px-5 py-3', className)}>
      {children}
    </div>
  );
}
