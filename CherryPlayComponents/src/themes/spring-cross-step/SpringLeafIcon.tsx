import React from 'react';

interface SpringLeafIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const SpringLeafIcon: React.FC<SpringLeafIconProps> = ({ size = 24, ...rest }) => {
  return (
    <svg viewBox="0 0 20 20" fill="none" width={size} height={size} {...rest}>
      <path d="M10 2 C4 8 4 14 10 18 C16 14 16 8 10 2Z" fill="#a5d67a" opacity="0.5" />
      <line
        x1="10"
        y1="4"
        x2="10"
        y2="16"
        stroke="#7cb342"
        strokeWidth="0.5"
        opacity="0.4"
      />
    </svg>
  );
};

