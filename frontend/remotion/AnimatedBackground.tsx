// components/AnimatedBackground.tsx
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();

  // Animation de boucle correcte
  const gradientAngle = interpolate(
    frame % 300, // Modulo pour créer une boucle
    [0, 300],
    [0, 360]
  );

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: `linear-gradient(${gradientAngle}deg, 
          rgba(255, 255, 255, 0.9) 0%, 
          rgba(220, 220, 220, 0.8) 50%, 
          rgba(255, 255, 255, 0.9) 100%)`,
        filter: 'blur(2px)',
      }}
    />
  );
};