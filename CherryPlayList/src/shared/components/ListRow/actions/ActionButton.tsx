import { IconButton } from '@cherryplay/components';
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
  /** Button variant from shared primitives */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Button size from shared primitives */
  size?: 'sm' | 'md';
  /** Suppress resting/hover border chrome (`cp-button--borderless`) */
  borderless?: boolean;
  /** Resting icon/border tone (`cp-button--tone-*`) */
  tone?: 'neutral' | 'danger';
  /** When false, hover keeps resting chrome (`cp-button--no-hover`) */
  hoverable?: boolean;
  /** Background fill mode (`cp-button--fill-*`) */
  filled?: 'none' | 'hover' | 'always';
  /** Optional aria-pressed for toggle buttons */
  'aria-pressed'?: boolean;
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
  variant = 'ghost',
  size = 'sm',
  borderless = false,
  tone = 'neutral',
  hoverable = true,
  filled = 'none',
  'aria-pressed': ariaPressed,
}) => {
  const { baseClassName, isLocked } = useListRowContext();
  const computedAriaLabel = ariaLabel ?? title ?? 'List row action';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !isLocked) {
      onClick?.(e);
    }
  };

  const buttonStyle: React.CSSProperties =
    hideWhenLocked && isLocked ? { visibility: 'hidden' } : {};

  return (
    <IconButton
      type="button"
      className={`${baseClassName}-action ${className || ''}`}
      onClick={handleClick}
      title={title}
      aria-label={computedAriaLabel}
      aria-pressed={ariaPressed}
      disabled={disabled || isLocked}
      style={buttonStyle}
      variant={variant}
      size={size}
      borderless={borderless}
      tone={tone}
      hoverable={hoverable}
      filled={filled}
      icon={icon}
    />
  );
};

ActionButton.displayName = 'ListRow.ActionButton';
