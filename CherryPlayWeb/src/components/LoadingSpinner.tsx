/**
 * Компонент индикатора загрузки
 */
import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Загрузка...',
}) => {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
      {message && <p className="loading-spinner-message">{message}</p>}
    </div>
  );
};

