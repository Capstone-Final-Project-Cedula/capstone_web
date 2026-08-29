import React, { useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Input — presentational only. Pass value/onChange straight through;
 * this component never touches validation logic, it only displays
 * the `error` string the caller already computed.
 */
const Input = React.forwardRef(function Input(
  {
    label,
    error,
    type = 'text',
    className = '',
    containerClassName = '',
    required = false,
    icon: Icon,
    ...rest
  },
  ref
) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--color-neutral-700)] mb-1.5"
        >
          {label}
          {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className="w-4 h-4 text-[var(--color-neutral-400)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
        )}

        <input
          ref={ref}
          id={id}
          type={resolvedType}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            'w-full h-11 rounded-[var(--radius-md)] border bg-white text-[15px]',
            'text-[var(--color-neutral-800)] placeholder:text-[var(--color-neutral-400)]',
            'transition-all duration-150 ease-out outline-none',
            Icon ? 'pl-10' : 'pl-3.5',
            isPassword ? 'pr-10' : 'pr-3.5',
            error
              ? 'border-[var(--color-error)] focus:shadow-[0_0_0_4px_rgba(208,52,44,0.12)]'
              : 'border-[var(--color-neutral-200)] focus:border-[var(--color-primary)] focus:shadow-[var(--shadow-focus)]',
            className,
          ].join(' ')}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[var(--color-error)] animate-fade-in"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;