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

// ── Glow Border (même système que les précédents) ──────────────────────────
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

// ── Typing Dots Component ──────────────────────────────────────────────────
const TypingDots: React.FC<{ frame: number; color?: string }> = ({ frame, color = '#9ca3af' }) => {
  const speed = 0.4;
  const dot1 = 0.5 + 0.5 * Math.sin(frame * speed);
  const dot2 = 0.5 + 0.5 * Math.sin(frame * speed - 1.2);
  const dot3 = 0.5 + 0.5 * Math.sin(frame * speed - 2.4);
  
  return (
    <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, alignItems: 'center', height: 16 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, opacity: 0.4 + 0.6 * dot1 }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, opacity: 0.4 + 0.6 * dot2 }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, opacity: 0.4 + 0.6 * dot3 }} />
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
export const Debate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // ── Caméra cinématique ───────────────────────────────────────────────────
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
  const pushZoom = interpolate(frame, [0.9 * fps, 5 * fps], [1.0, 1.03], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = scaleBase * pushZoom;
  const y = interpolate(frame, [0, 0.9 * fps], [20, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blur = interpolate(frame, [0, 0.5 * fps], [6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ── Messages config ───────────────────────────────────────────────────────
const MESSAGES = [
  { id: 1, author: 'Alex', initial: 'A', side: 'left' as const, text: 'Deploy looks good on CI', delay: 0.4, color: '#4b5563', bg: '#e3e3e3' },

  { id: 2, author: 'Mike', initial: 'M', side: 'left' as const, text: 'I’m seeing some errors in production...', delay: 1.4, color: '#4b5563', bg: '#e3e3e3' },

  { id: 3, author: 'Sarah', initial: 'S', side: 'right' as const, text: "Latency is slightly up but nothing major", delay: 2.2, color: '#f9fafb', bg: '#4b5563' },

  { id: 4, author: 'Julie', initial: 'J', side: 'left' as const, text: 'Do we rollback or wait?', delay: 3.0, color: '#4b5563', bg: '#e3e3e3' },

  { id: 5, author: 'Alex', initial: 'A', side: 'left' as const, text: '', delay: 3.6, color: '#4b5563', bg: '#e3e3e3', isTyping: true },
];

  const cardShell: React.CSSProperties = {
    position: 'absolute', inset: 0, borderRadius: CARD_RX,
    background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(245,245,245,0.95) 100%)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.04), 0 20px 48px rgba(0,0,0,0.08), 0 48px 96px rgba(0,0,0,0.05)',
  };

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
            <GlowBorder uid="deb" frame={frame} fps={fps} />
            
            {/* Interface Slack-like */}
            <div style={{
              position: 'absolute', inset: 0, padding: '40px 60px',
              display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
            }}>
              {/* Header */}
              <div style={{ marginBottom: 32, borderBottom: '1px solid #e5e7eb', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#9ca3af' }} />
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em' }}>#e-commerce</span>
                </div>
                <div style={{ fontSize: 19, color: '#9ca3af', marginTop: 4, marginLeft: 20 }}>
                  4 membres • en ligne
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, overflow: 'hidden' }}>
                {MESSAGES.map((msg) => {
                  const start = msg.delay * fps;
                  const progress = interpolate(frame, [start, start + 0.5 * fps], [0, 1], {
                    easing: Easing.out(Easing.back(1.2)), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
                  });
                  
                  if (progress <= 0) return null;

                  const isLeft = msg.side === 'left';
                  const translateX = isLeft ? -40 * (1 - progress) : 40 * (1 - progress);
                  
                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      alignSelf: isLeft ? 'flex-start' : 'flex-end',
                      alignItems: 'flex-end',
                      gap: 12,
                      opacity: progress,
                      transform: `translateX(${translateX}px) scale(${0.95 + 0.05 * progress})`,
                      maxWidth: '75%',
                    }}>
                      {/* Avatar (seulement à gauche ou pour équilibre visuel) */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isLeft ? '#e5e7eb' : '#6b7280',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, color: isLeft ? '#4b5563' : '#f3f4f6',
                        flexShrink: 0, marginBottom: 2,
                      }}>
                        {msg.initial}
                      </div>

                      {/* Bubble */}
                      <div style={{
                        background: msg.bg,
                        padding: '17px 25px',
                        borderRadius: 18,
                        borderBottomLeftRadius: isLeft ? 4 : 18,
                        borderBottomRightRadius: isLeft ? 18 : 4,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        position: 'relative',
                      }}>
                        <div style={{
                          fontSize: 19, fontWeight: 600, color: isLeft ? '#6b7280' : '#d1d5db',
                          marginBottom: 4, letterSpacing: '0.02em',
                        }}>
                          {msg.author}
                        </div>
                        <div style={{
                          fontSize: 23, lineHeight: 1.4, color: msg.color,
                          fontWeight: 500,
                        }}>
                          {msg.text}
                          {msg.isTyping && <TypingDots frame={frame} color={isLeft ? '#9ca3af' : '#d1d5db'} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input box (vide, figé) pour l'immersion */}
              <div style={{
                marginTop: 'auto',
                padding: '14px 18px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                opacity: 0.6,
              }}>
                <span style={{ color: '#4d4d4d', fontSize: 19 }}>Write a message...</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: '#e5e7eb' }} />
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: '#e5e7eb' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};