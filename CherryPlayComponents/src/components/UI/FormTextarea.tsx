import * as React from 'react';

import './FormTextarea.css';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  error,
  hint,
  id,
  className = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}) => {
  const textareaId = id || `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const describedBy = [
    ariaDescribedBy,
    error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  const textareaClassName = `form-textarea ${error ? 'form-textarea--error' : ''} ${className}`.trim();

  return (
    <div className="form-group">
      <label htmlFor={textareaId} className="form-label">
        {label}
      </label>
      <textarea
        id={textareaId}
        className={textareaClassName}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : ariaInvalid}
        {...props}
      />
      {hint && !error && (
        <span className="form-hint" id={`${textareaId}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="form-error" id={`${textareaId}-error`}>
          {error}
        </span>
      )}
    </div>
  );
};
