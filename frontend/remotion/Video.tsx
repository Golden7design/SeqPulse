import {interpolate, useCurrentFrame, useVideoConfig, spring} from 'remotion';

export type MainVideoProps = {
  title: string;
  subtitle?: string;
};

export const MainVideo: React.FC<MainVideoProps> = ({title, subtitle}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const appear = spring({
    frame,
    fps,
    config: {damping: 200, mass: 1.2, stiffness: 120},
  });

  const fadeOut = interpolate(frame, [durationInFrames - 40, durationInFrames - 10], [1, 0], {
    extrapolateRight: 'clamp',
  });

  const bgShift = interpolate(frame, [0, durationInFrames], [0, 360]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `conic-gradient(from ${bgShift}deg, #0ea5e9, #a855f7, #f43f5e, #0ea5e9)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${0.8 + appear * 0.2}) translateY(${interpolate(appear, [0, 1], [40, 0])}px)`,
          opacity: Math.min(appear, fadeOut),
          transition: 'opacity 0.2s linear',
        }}
      >
        <h1 style={{fontSize: 90, letterSpacing: -1, margin: 0}}>{title}</h1>
        {subtitle ? (
          <p style={{fontSize: 36, marginTop: 16, opacity: 0.9}}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
};
