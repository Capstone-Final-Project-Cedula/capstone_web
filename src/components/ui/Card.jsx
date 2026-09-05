import React from 'react';

/**
 * Card — soft-shadow container used across the app.
 * hoverable: adds a gentle lift on hover, for cards that represent
 * clickable/navigable items (not for static content cards).
 * accent: optional tone ('primary' | 'success' | 'warning' | 'error' | 'info' | 'qr')
 *         renders a 3px left border in that color — handy for status-flavored
 *         cards (e.g. an overdue-item card) without changing the base look.
 */
const ACCENT_STYLES = {
  primary: 'border-l-[3px] border-l-[var(--color-primary)]',
  success: 'border-l-[3px] border-l-[var(--color-success)]',
  warning: 'border-l-[3px] border-l-[var(--color-warning)]',
  error: 'border-l-[3px] border-l-[var(--color-error)]',
  info: 'border-l-[3px] border-l-[var(--color-info)]',
  qr: 'border-l-[3px] border-l-[var(--color-qr)]',
};

const Card = ({ children, className = '', hoverable = false, accent, as: Tag = 'div', ...rest }) => {
  return (
    <Tag
      className={[
        'bg-white rounded-[var(--radius-lg)] border border-[var(--color-neutral-100)]',
        'shadow-[var(--shadow-sm)] transition-all duration-200 ease-out',
        hoverable ? 'hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5' : '',
        accent ? ACCENT_STYLES[accent] : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <div className={`px-6 pt-6 ${className}`}>{children}</div>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={`px-6 py-6 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }) => (
  <div className={`px-6 pb-6 pt-2 ${className}`}>{children}</div>
);

export default Card;