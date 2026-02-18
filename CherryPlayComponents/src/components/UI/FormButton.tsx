import React from 'react';
import './FormButton.css';

export interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  fullWidth?: boolean;
}

export const FormButton: React.FC<FormButtonProps> = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const buttonClassName = `form-button form-button--${variant} ${
    fullWidth ? 'form-button--full-width' : ''
  } ${loading ? 'form-button--loading' : ''} ${className}`.trim();

  return (
    <button className={buttonClassName} disabled={disabled || loading} {...props}>
      {loading ? 'Загрузка...' : children}
    </button>
  );
};
