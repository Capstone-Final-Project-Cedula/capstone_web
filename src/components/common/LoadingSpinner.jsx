import React from 'react';
import { Loader2 } from 'lucide-react';

const SIZE_MAP = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-9 h-9',
};

/**
 * LoadingSpinner — same public API as before (`size` prop), redesigned
 * visually. Used both standalone and inline (e.g. next to a caption).
 */
const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  return (
    <span className={`inline-flex items-center justify-center ${className}`} role="status">
      <Loader2
        className={`${sizeClass} text-[var(--color-primary)] animate-spin`}
        style={{ animationDuration: '0.8s' }}
        aria-hidden="true"
      />
      <span className="sr-only">Loading…</span>
    </span>
  );
};

export default LoadingSpinner;