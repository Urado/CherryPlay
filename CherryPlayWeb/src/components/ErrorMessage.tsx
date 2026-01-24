/**
 * Компонент отображения ошибки
 */
import React from 'react';
import './ErrorMessage.css';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="error-message-container">
      <div className="error-message">
        <div className="error-message-icon">⚠️</div>
        <h2 className="error-message-title">Ошибка</h2>
        <p className="error-message-text">{message}</p>
        {onRetry && (
          <button className="error-message-retry" onClick={onRetry}>
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
};
