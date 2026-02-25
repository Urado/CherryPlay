import React, { useEffect, useState } from 'react';

interface Petal {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  type: 'petal' | 'leaf';
}

/**
 * Floating petals/leaves background for spring-cross-step theme.
 * Renders animated SVG elements that fall from top to bottom.
 */
export const FloatingPetals: React.FC = () => {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    const items: Petal[] = Array.from({ length: 48 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 8 + Math.random() * 6,
      size: 8 + Math.random() * 14,
      type: Math.random() > 0.5 ? 'petal' : 'leaf',
    }));
    setPetals(items);
  }, []);

  return (
    <div className="party-display-floating-petals" aria-hidden>
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="spring-petal"
          style={{
            left: `${petal.left}%`,
            top: '-20px',
            animationDelay: `${petal.delay}s`,
            animationDuration: `${petal.duration}s`,
            width: petal.size,
            height: petal.size,
          }}
        >
          {petal.type === 'petal' ? (
            <svg viewBox="0 0 20 20" fill="none" width={petal.size} height={petal.size}>
              <ellipse
                cx="10"
                cy="10"
                rx="6"
                ry="9"
                fill="#fce4ec"
                opacity="0.7"
                transform="rotate(15 10 10)"
              />
              <ellipse
                cx="10"
                cy="10"
                rx="4"
                ry="7"
                fill="#f8bbd0"
                opacity="0.4"
                transform="rotate(15 10 10)"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="none" width={petal.size} height={petal.size}>
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
          )}
        </div>
      ))}
    </div>
  );
};
