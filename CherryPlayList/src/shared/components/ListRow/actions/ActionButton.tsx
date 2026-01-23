import React from 'react';

import { useListRowContext } from '../ListRowContext';

/**
 * Props for ActionButton component
 */
export interface ActionButtonProps {
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
  /** Button title/tooltip */
  title?: string;
  /** Aria label for accessibility */
  'aria-label'?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Icon to display */
  icon: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Whether to hide when row is locked */
  hideWhenLocked?: boolean;
}

/**
 * ActionButton - Generic action button component
 *
 * Base component for all action buttons in ListRow.
 * Provides consistent styling and behavior.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  title,
  'aria-label': ariaLabel,
  disabled = false,
  icon,
  className,
  hideWhenLocked = false,
}) => {
  const { baseClassName, isLocked } = useListRowContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !isLocked) {
      onClick?.(e);
    }
  };

  const buttonStyle: React.CSSProperties =
    hideWhenLocked && isLocked ? { visibility: 'hidden' } : {};

  return (
    <button
      type="button"
      className={`${baseClassName}-action ${className || ''}`}
      onClick={handleClick}
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled || isLocked}
      style={buttonStyle}
    >
      {icon}
    </button>
  );
};

ActionButton.displayName = 'ListRow.ActionButton';
