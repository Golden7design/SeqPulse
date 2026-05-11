import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

// ── Card dimensions ────────────────────────────────────────────────────────
const CARD_W = 1440;
const CARD_H = 950;
const CARD_RX = 26;

const PERIMETER =
  2 * (CARD_W - 2 * CARD_RX) +
  2 * (CARD_H - 2 * CARD_RX) +
  2 * Math.PI * CARD_RX;

const POOL_LG = PERIMETER * 0.52;
const POOL_MD = PERIMETER * 0.36;
const POOL_SM = PERIMETER * 0.24;

// ── Soft Glow Border (identique à PipelineSuccess) ─────────────────────────
interface GlowBorderProps { uid: string; frame: number; fps: number; }

const GlowBorder: React.FC<GlowBorderProps> = ({ uid, frame, fps }) => {
  const t = frame / fps;
  const L1 = 5.2 * fps;
  const L2 = 7.0 * fps;
  const L3 = 4.0 * fps;
  const off1 = -((frame % L1) / L1) * PERIMETER;
  const off2 = -(((frame + L2 * 0.4) % L2) / L2) * PERIMETER;
  const off3 = -(((frame + L3 * 0.65) % L3) / L3) * PERIMETER;

  const p1 = 0.78 + 0.22 * Math.sin(t * 0.85);
  const p2 = 0.72 + 0.28 * Math.sin(t * 1.25 + 1.1);
  const p3 = 0.82 + 0.18 * Math.sin(t * 1.65 + 2.3);

  const PAD = 60;

  return (
    <svg
      width={CARD_W + PAD * 2}
      height={CARD_H + PAD * 2}
      viewBox={`0 0 ${CARD_W + PAD * 2} ${CARD_H + PAD * 2}`}
      style={{ position: 'absolute', top: -PAD, left: -PAD, overflow: 'visible', pointerEvents: 'none' }}
    >
      <defs>
        <filter id={`gO-${uid}`} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="32" /></filter>
        <filter id={`gM-${uid}`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="16" /></filter>
        <filter id={`gI-${uid}`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id={`gE-${uid}`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#5a5a5a" strokeWidth={38}
        strokeDasharray={`${POOL_LG} ${PERIMETER - POOL_LG}`} strokeDashoffset={off1}
        filter={`url(#gO-${uid})`} opacity={0.20 * p1}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#808080" strokeWidth={22}
        strokeDasharray={`${POOL_MD} ${PERIMETER - POOL_MD}`} strokeDashoffset={off2}
        filter={`url(#gM-${uid})`} opacity={0.24 * p2}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#a0a0a0" strokeWidth={10}
        strokeDasharray={`${POOL_SM} ${PERIMETER - POOL_SM}`} strokeDashoffset={off3}
        filter={`url(#gI-${uid})`} opacity={0.30 * p3}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#909090" strokeWidth={3} filter={`url(#gE-${uid})`} opacity={0.14}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#b5b5b5" strokeWidth={0.5} opacity={0.18}/>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
export const SlowAnalyse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // ── Caméra ───────────────────────────────────────────────────────────────
  const cameraBreathe = 1 + 0.012 * Math.sin(t * 0.55);
  const cameraY = 4 * Math.sin(t * 0.4 + 0.3);
  const cameraX = 2.5 * Math.cos(t * 0.35 + 1.1);

  // ── Fond animé ───────────────────────────────────────────────────────────
  const g1x = 22 + 16 * Math.sin(t * 0.31); const g1y = 18 + 14 * Math.cos(t * 0.27);
  const g2x = 68 + 14 * Math.cos(t * 0.23); const g2y = 72 + 16 * Math.sin(t * 0.19);
  const g3x = 48 + 22 * Math.sin(t * 0.17 + 1.2); const g3y = 38 + 18 * Math.cos(t * 0.22 + 0.7);
  const g4x = 82 + 10 * Math.cos(t * 0.37 + 2.1); const g4y = 22 + 12 * Math.sin(t * 0.29 + 1.8);
  const g5x = 15 + 12 * Math.sin(t * 0.41 + 0.4); const g5y = 75 + 10 * Math.cos(t * 0.33 + 2.4);
  const bg = [
    `radial-gradient(ellipse 55% 48% at ${g1x}% ${g1y}%, #c8c8c8 0%, transparent 72%)`,
    `radial-gradient(ellipse 48% 58% at ${g2x}% ${g2y}%, #b0b0b0 0%, transparent 68%)`,
    `radial-gradient(ellipse 65% 52% at ${g3x}% ${g3y}%, #e2e2e2 0%, transparent 70%)`,
    `radial-gradient(ellipse 42% 44% at ${g4x}% ${g4y}%, #9e9e9e 0%, transparent 62%)`,
    `radial-gradient(ellipse 38% 50% at ${g5x}% ${g5y}%, #d4d4d4 0%, transparent 65%)`,
    '#e6e6e6',
  ].join(', ');

  // ── Entrée de la carte ───────────────────────────────────────────────────
  const opacity = interpolate(frame, [0, 0.7 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scaleBase = interpolate(frame, [0, 0.9 * fps], [0.78, 1.0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pushZoom = interpolate(frame, [0.9 * fps, 4 * fps], [1.0, 1.04], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = scaleBase * pushZoom;
  const y = interpolate(frame, [0, 0.9 * fps], [20, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blur = interpolate(frame, [0, 0.5 * fps], [6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ── Timeline data ────────────────────────────────────────────────────────
  const ITEMS = [
    { time: '14:02', text: 'Deploy success', status: 'success', extra: ' ✅' },
    { time: '14:06', text: 'Checking metrics...', status: 'info' },
    { time: '14:11', text: 'Checking metrics...', status: 'info' },
    { time: '14:17', text: 'Still unsure...', status: 'warn' },
  ];

  const START = 0.6 * fps;
  const STEP = 0.95 * fps;

  // Hauteur de la ligne verticale qui grandit
  const lineH = interpolate(frame, [START, START + STEP * 3], [0, 124 * 3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cardShell: React.CSSProperties = {
    position: 'absolute', inset: 0, borderRadius: CARD_RX,
    background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(245,245,245,0.95) 100%)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.04), 0 20px 48px rgba(0,0,0,0.08), 0 48px 96px rgba(0,0,0,0.05)',
  };
  const innerPad: React.CSSProperties = {
    position: 'absolute', inset: 0, padding: '48px 56px',
    display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
  };

  const Header = ({ label, color, subtitle }: { label: string; color: string; subtitle?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
          <span style={{ fontSize: 22, fontWeight: 700, color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        </div>
        {subtitle && <span style={{ fontSize: 19, color: '#aaa', marginLeft: 20 }}>{subtitle}</span>}
      </div>
    </div>
  );

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, fontFamily: '"DM Sans","SF Pro Display",Inter,system-ui,sans-serif', overflow: 'hidden',
    }}>
      <div style={{ transform: `scale(${cameraBreathe}) translate(${cameraX}px, ${cameraY}px)` }}>
        <div style={{ position: 'relative', width: CARD_W, height: CARD_H }}>
          <div style={{
            position: 'absolute', inset: 0, opacity,
            transform: `scale(${scale}) translateY(${y}px)`,
            filter: `blur(${blur}px)`, willChange: 'transform, opacity, filter',
          }}>
            <div style={cardShell} />
            <GlowBorder uid="sa" frame={frame} fps={fps} />
            <div style={innerPad}>
              <Header label="Slow Analysis" color="#f59e0b" subtitle="decision latency · 15m window" />

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: 1080, height: 520 }}>
                  {/* Ligne verticale */}
                  <div style={{
                    position: 'absolute', left: 36, top: 16, width: 3, height: lineH,
                    background: 'linear-gradient(to bottom, #6b7280, #374151)', borderRadius: 2,
                  }} />

                  {ITEMS.map((it, i) => {
                    const appear = START + i * STEP;
                    const anim = interpolate(frame, [appear, appear + 0.4 * fps], [0, 1], {
                      easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                    });
                    if (anim <= 0) return null;

                    const dotColor = it.status === 'success' ? '#22c55e' : it.status === 'warn' ? '#f59e0b' : '#6b7280';
                    const textColor = it.status === 'success' ? '#22c55e' : it.status === 'warn' ? '#f59e0b' : '#9ca3af';
                    const shake = it.status === 'warn' ? 2.5 * Math.sin(t * 14) * anim : 0;

                    return (
                      <div key={i} style={{
                        position: 'absolute', left: 0, top: i * 124,
                        display: 'flex', alignItems: 'center', gap: 26,
                        opacity: anim, transform: `translateX(${(1 - anim) * 22}px) translateX(${shake}px)`,
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', background: dotColor,
                          boxShadow: `0 0 ${14 * anim}px ${dotColor}`,
                        }} />
                        <span style={{
                          fontFamily: '"SF Mono","Fira Code",Consolas,monospace',
                          fontSize: 22, color: '#6b7280', width: 110,
                        }}>{it.time}</span>
                        <span style={{ fontSize: 32, color: textColor, fontWeight: 700 }}>
                          {it.text}{it.extra || ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
