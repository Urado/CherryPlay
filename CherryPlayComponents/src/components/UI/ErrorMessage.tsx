import React from 'react';
import './ErrorMessage.css';

export interface ErrorMessageProps {
  message: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return <div className={`error-message ${className}`.trim()}>{message}</div>;
};
