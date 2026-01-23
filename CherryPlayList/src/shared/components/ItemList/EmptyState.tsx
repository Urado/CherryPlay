import React from 'react';

/**
 * Props for EmptyState component
 */
export interface EmptyStateProps {
  /** Main message to display */
  message?: string;
  /** Secondary hint text */
  hint?: string;
  /** Custom icon to display */
  icon?: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Children to render instead of default content */
  children?: React.ReactNode;
}

/**
 * EmptyState - Component to display when a list is empty
 *
 * Provides a consistent empty state UI across all list views.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   message="Playlist is empty"
 *   hint="Drag and drop files to add tracks"
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No items',
  hint,
  icon,
  className,
  children,
}) => {
  const computedClassName = ['empty-state', className].filter(Boolean).join(' ');

  if (children) {
    return <div className={computedClassName}>{children}</div>;
  }

  return (
    <div className={computedClassName}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p>{message}</p>
      {hint && <p className="empty-state-hint">{hint}</p>}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
