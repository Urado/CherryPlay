import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'medium', className = '' }) => {
  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '48px',
  };

  return (
    <div
      className={`spinner spinner-${size} ${className}`}
      style={{ width: sizeMap[size], height: sizeMap[size] }}
    >
      <div className="spinner-circle"></div>
    </div>
  );
};
