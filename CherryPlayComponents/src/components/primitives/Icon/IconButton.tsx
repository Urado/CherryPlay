import React from 'react';

import { Button, type ButtonProps } from '../Button/Button';

import { Icon, type IconSize } from './Icon';

export interface IconButtonProps extends Omit<
  ButtonProps,
  'iconOnly' | 'children' | 'startIcon' | 'endIcon'
> {
  icon: React.ReactNode;
  iconSize?: IconSize;
  'aria-label': string;
}

function mapButtonSizeToIconSize(size: IconButtonProps['size']): IconSize {
  return size === 'sm' ? 'sm' : 'md';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'md', iconSize, ...buttonProps }, ref) => (
    <Button
      ref={ref}
      iconOnly
      size={size}
      startIcon={<Icon size={iconSize ?? mapButtonSizeToIconSize(size)}>{icon}</Icon>}
      {...buttonProps}
    />
  ),
);

IconButton.displayName = 'IconButton';
