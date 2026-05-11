// components/CursorComponent.tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface CursorProps {
  x: number;
  y: number;
  frame: number;
}

export const CursorComponent: React.FC<CursorProps> = ({ x, y, frame }) => {
  // Effet zoom au clic
  const isClicking = [5, 11, 14].some(
    (sec) =>
      frame >= sec * 30 - 3 &&
      frame <= sec * 30 + 3
  );

  const scale = isClicking ? 1.3 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 24,
        height: 24,
        pointerEvents: 'none',
        zIndex: 1000,
        transform: `scale(${scale})`,
        transition: 'transform 0.1s ease',
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M3 3l7.07 18.97.5-.5 8.97-7.97"
          strokeWidth={2}
          fill="currentColor"
          stroke="#000"
          color="#fff"
        />
      </svg>
    </div>
  );
};