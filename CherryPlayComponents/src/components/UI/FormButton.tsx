import React from 'react';

import { Button, type ButtonVariant } from '../primitives/Button/Button';

import './FormButton.css';

export interface FormButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

function mapVariant(variant: FormButtonProps['variant']): ButtonVariant {
  if (variant === 'outline') {
    return 'ghost';
  }
  return variant ?? 'primary';
}

export const FormButton: React.FC<FormButtonProps> = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  children,
  className,
  disabled,
  ...props
}) => (
  <Button
    variant={mapVariant(variant)}
    loading={loading}
    fullWidth={fullWidth}
    className={['form-button', variant === 'outline' ? 'form-button--outline' : '', className]
      .filter(Boolean)
      .join(' ')}
    disabled={disabled}
    {...props}
  >
    {children}
  </Button>
);
