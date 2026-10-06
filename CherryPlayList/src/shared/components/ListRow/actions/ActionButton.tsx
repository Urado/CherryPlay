import { IconButton } from '@cherryplay/components';
import React from 'react';

import { useListRowContext } from '../ListRowContext';

export interface ActionButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  'aria-label'?: string;
  disabled?: boolean;
  icon: React.ComponentProps<typeof IconButton>['icon'];
  className?: string;
  hideWhenLocked?: boolean;
  allowWhenPlayedLocked?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  borderless?: boolean;
  tone?: 'neutral' | 'danger';
  hoverable?: boolean;
  filled?: 'none' | 'hover' | 'always';
  'aria-pressed'?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  title,
  'aria-label': ariaLabel,
  disabled = false,
  icon,
  className,
  hideWhenLocked = false,
  allowWhenPlayedLocked = false,
  variant = 'ghost',
  size = 'sm',
  borderless = false,
  tone = 'neutral',
  hoverable = true,
  filled = 'none',
  'aria-pressed': ariaPressed,
}) => {
  const { baseClassName, isLocked, isPlayed, isCurrent } = useListRowContext();
  const computedAriaLabel = ariaLabel ?? title ?? 'List row action';
  const isLockedForAction = isLocked && !(allowWhenPlayedLocked && isPlayed && !isCurrent);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && !isLockedForAction) {
      onClick?.(e);
    }
  };

  const buttonStyle: React.CSSProperties =
    hideWhenLocked && isLockedForAction ? { visibility: 'hidden' } : {};

  return (
    <IconButton
      type="button"
      className={`${baseClassName}-action ${className || ''}`}
      onClick={handleClick}
      title={title}
      aria-label={computedAriaLabel}
      aria-pressed={ariaPressed}
      disabled={disabled || isLockedForAction}
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
