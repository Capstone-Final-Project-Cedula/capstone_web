import React from 'react';
import Button from './Button';

/**
 * EmptyState — attractive placeholder for "nothing here yet" moments.
 * Purely presentational: the caller supplies the action's onClick.
 */
const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
      {Icon && (
        <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] flex items-center justify-center mb-4 transition-transform duration-300 ease-out hover:scale-105">
          <Icon className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-[var(--color-neutral-800)] mb-1 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-neutral-500)] max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} icon={actionIcon} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;