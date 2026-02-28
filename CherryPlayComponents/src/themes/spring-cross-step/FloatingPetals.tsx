import React, { useState } from 'react';

import { SakuraPetalIcon } from './SakuraPetalIcon';
import { SpringLeafIcon } from './SpringLeafIcon';

interface Petal {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  type: 'petal' | 'leaf';
  swayAmplitude: number;
  swayDirection: 1 | -1;
  rotationTurns: number;
}

/**
 * Floating petals/leaves background for spring-cross-step theme.
 * Renders animated SVG elements that fall from top to bottom.
 */
export const FloatingPetals: React.FC = () => {
  const [petals] = useState<Petal[]>(() =>
    Array.from({ length: 48 }, (_, i) => {
      const baseDuration = 18;
      const duration = baseDuration + Math.random() * 10;
      const size = 24 + Math.random() * 40;

      // Slower-falling elements (longer duration) rotate faster:
      // rotationTurns grows roughly with the square of the duration
      // so angular speed is inversely proportional to fall speed.
      const normalizedDuration = duration / baseDuration;
      const rotationTurns = 2 * normalizedDuration * normalizedDuration;

      return {
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 12,
        duration,
        size,
        type: Math.random() > 0.5 ? 'petal' : 'leaf',
        // Horizontal sway amplitude is roughly 4× petal length, with some variation per petal.
        swayAmplitude: size * (3.5 + Math.random() * 1.5),
        swayDirection: Math.random() > 0.5 ? 1 : -1,
        rotationTurns,
      };
    }),
  );

  return (
    <div className="party-display-floating-petals" aria-hidden="true">
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="spring-petal"
          style={
            {
              left: `${petal.left}%`,
              top: '-20px',
              animationDelay: `${petal.delay}s`,
              animationDuration: `${petal.duration}s`,
              width: petal.size,
              height: petal.size,
              '--petal-sway-amplitude': `${petal.swayAmplitude}px`,
              '--petal-sway-direction': petal.swayDirection,
              '--petal-rotation-turns': petal.rotationTurns,
            } as React.CSSProperties
          }
        >
          {petal.type === 'petal' ? (
            <SakuraPetalIcon size={petal.size} />
          ) : (
            <SpringLeafIcon size={petal.size} />
          )}
        </div>
      ))}
    </div>
  );
};
