import * as React from 'react';

import { cn } from '../../../utils/cn';

import './Icon.css';

export type IconSize = 'sm' | 'md' | 'lg';
export type IconShape = 'none' | 'circle';

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: IconSize;
  /** `circle` — square hit-box with circular outline (`cp-icon--circle`). */
  shape?: IconShape;
  className?: string;
  children: React.ReactNode;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export const Icon: React.FC<IconProps> = ({
  size = 'md',
  shape = 'none',
  className,
  children,
  'aria-hidden': ariaHidden = true,
  ...rest
}) => (
  <span
    className={cn(
      'cp-icon',
      `cp-icon--${size}`,
      shape === 'circle' && 'cp-icon--circle',
      className,
    )}
    aria-hidden={ariaHidden}
    {...rest}
  >
    {children}
  </span>
);
