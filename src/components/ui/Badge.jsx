import React from 'react';

/**
 * Badge — small status/category pill.
 * tone: 'primary' | 'voice' | 'qr' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
 */
const TONE_STYLES = {
  primary: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
  voice: 'bg-[var(--color-voice-light)] text-[var(--color-voice)]',
  qr: 'bg-[var(--color-qr-light)] text-[var(--color-qr)]',
  success: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
  error: 'bg-[var(--color-error-light)] text-[var(--color-error)]',
  info: 'bg-[var(--color-info-light)] text-[var(--color-info)]',
  neutral: 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]',
};

const Badge = ({ children, tone = 'neutral', icon: Icon, className = '' }) => {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-pill)]',
        'text-xs font-semibold leading-none',
        TONE_STYLES[tone],
        className,
      ].join(' ')}
    >
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
      {children}
    </span>
  );
};

export default Badge;