import * as React from 'react';
import './FormSelect.css';

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  error,
  hint,
  id,
  className = '',
  children,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}) => {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const describedBy = [
    ariaDescribedBy,
    error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const selectClassName = `form-select ${error ? 'form-select--error' : ''} ${className}`.trim();

  return (
    <div className="form-group">
      <label htmlFor={selectId} className="form-label">
        {label}
      </label>
      <select
        id={selectId}
        className={selectClassName}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : ariaInvalid}
        {...props}
      >
        {children}
      </select>
      {hint && !error && (
        <span className="form-hint" id={`${selectId}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="form-error" id={`${selectId}-error`}>
          {error}
        </span>
      )}
    </div>
  );
};
