import React from 'react';

/**
 * Badge — small status/category pill.
 * tone: 'primary' | 'voice' | 'qr' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
 * dot: when true, renders a small solid dot instead of/alongside an icon —
 *      useful for live-status badges (e.g. "Active", "Pending") where a dot
 *      reads faster than an icon.
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

const DOT_STYLES = {
  primary: 'bg-[var(--color-primary)]',
  voice: 'bg-[var(--color-voice)]',
  qr: 'bg-[var(--color-qr)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  error: 'bg-[var(--color-error)]',
  info: 'bg-[var(--color-info)]',
  neutral: 'bg-[var(--color-neutral-500)]',
};

const Badge = ({ children, tone = 'neutral', icon: Icon, dot = false, className = '' }) => {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-pill)]',
        'text-xs font-semibold leading-none tracking-tight',
        'transition-colors duration-150',
        TONE_STYLES[tone],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_STYLES[tone]}`}
          aria-hidden="true"
        />
      )}
      {Icon && !dot && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
};

export default Badge;