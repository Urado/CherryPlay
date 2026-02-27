import React from 'react';

interface SakuraPetalIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Single sakura (cherry blossom) petal:
 * - Rounded base with two lobes and shallow cleft, pointed tip
 * - Asymmetric outline
 * - Fades to white toward the sharp end
 */
export const SakuraPetalIcon: React.FC<SakuraPetalIconProps> = ({ size = 24, ...rest }) => {
  const gradientId = React.useId().replace(/:/g, '-');
  return (
    <svg viewBox="0 0 20 20" fill="none" width={size} height={size} {...rest}>
      <defs>
        <linearGradient
          id={gradientId}
          x1="10"
          y1="20"
          x2="10"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#f8bbd0" />
          <stop offset="0.4" stopColor="#fce4ec" />
          <stop offset="0.85" stopColor="#fef6f9" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* Asymmetric sakura petal: pointed tip at top, round base with two lobes + cleft at bottom */}
      <path
        d="M 10.4 0.6
           C 5 4 2 10 3.5 16.5
           C 4.2 18.2 6 19.2 8 19.5
           C 9.2 19.65 10 19.35 10.5 19.5
           C 11 19.35 11.8 19.65 13 19.5
           C 15 19.2 16.8 18.2 17.5 16.5
           C 19 10 16 4 10.4 0.6 Z"
        fill={`url(#${gradientId})`}
        opacity="0.95"
      />
    </svg>
  );
};
