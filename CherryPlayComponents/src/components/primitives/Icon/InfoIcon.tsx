import React from 'react';

import { cn } from '../../../utils/cn';

import { Icon, type IconSize } from './Icon';

export interface InfoIconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: IconSize;
  /** Tooltip / accessible name (required). */
  title: string;
  'aria-label'?: string;
}

/**
 * Compact “i” help marker with circular outline (`Icon` + `shape="circle"`).
 */
export const InfoIcon: React.FC<InfoIconProps> = ({
  size = 'sm',
  className,
  title,
  'aria-label': ariaLabel,
  style,
  ...rest
}) => (
  <Icon
    {...rest}
    size={size}
    shape="circle"
    className={cn('cp-icon--info', className)}
    title={title}
    role="img"
    aria-label={ariaLabel ?? title}
    aria-hidden={false}
    style={style}
  >
    i
  </Icon>
);
