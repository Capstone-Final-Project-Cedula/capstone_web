import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button — presentational only. Wraps whatever onClick/type/disabled
 * behavior the caller passes in; adds no logic of its own.
 *
 * variant: 'primary' | 'secondary' | 'ghost' | 'danger'
 * size:    'sm' | 'md' | 'lg'
 */
const VARIANT_STYLES = {
  primary:
    'bg-[var(--color-primary)] text-white shadow-sm ' +
    'hover:bg-[var(--color-primary-hover)] hover:shadow-md hover:-translate-y-px ' +
    'active:bg-[var(--color-primary-active)] active:translate-y-0 active:scale-[0.97] active:shadow-sm',
  secondary:
    'bg-white text-[var(--color-neutral-700)] border border-[var(--color-neutral-200)] ' +
    'hover:bg-[var(--color-neutral-50)] hover:border-[var(--color-neutral-300)] hover:-translate-y-px hover:shadow-sm ' +
    'active:translate-y-0 active:scale-[0.97] active:bg-[var(--color-neutral-100)]',
  ghost:
    'bg-transparent text-[var(--color-neutral-600)] ' +
    'hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-800)] ' +
    'active:scale-[0.97] active:bg-[var(--color-neutral-200)]',
  danger:
    'bg-white text-[var(--color-error)] border border-[var(--color-error-light)] ' +
    'hover:bg-[var(--color-error-light)] hover:border-[var(--color-error)] ' +
    'active:scale-[0.97]',
};

const SIZE_STYLES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
};

const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    className = '',
    type = 'button',
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'group/btn focusable inline-flex items-center justify-center font-medium rounded-[var(--radius-md)]',
        'transition-all duration-150 ease-out select-none whitespace-nowrap',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon &&
        iconPosition === 'left' && (
          <Icon
            className="w-4 h-4 transition-transform duration-150 group-hover/btn:scale-110"
            aria-hidden="true"
          />
        )
      )}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'right' && (
        <Icon
          className="w-4 h-4 transition-transform duration-150 group-hover/btn:translate-x-0.5"
          aria-hidden="true"
        />
      )}
    </button>
  );
});

export default Button;