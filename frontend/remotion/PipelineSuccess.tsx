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

// ── Graph configs ──────────────────────────────────────────────────────────
const GW = 300;
const GH = 160;
const G_NORM_Y = 135;
const G_SPIKE_Y = 16;

function buildGraph(spikeAnim: number): [number, number][] {
  const spY = G_NORM_Y - (G_NORM_Y - G_SPIKE_Y) * spikeAnim;
  return [
    [0, G_NORM_Y], [31, G_NORM_Y - 8], [61, G_NORM_Y + 4],
    [92, G_NORM_Y - 6], [133, G_NORM_Y - 2], [156, G_NORM_Y + 2],
    [172, spY], [189, G_NORM_Y - 4], [222, G_NORM_Y + 3],
    [257, G_NORM_Y - 4], [GW, G_NORM_Y],
  ];
}

function buildLatencyGraph(anim: number): [number, number][] {
  const endY = G_NORM_Y - 100 * anim;
  return [
    [0, G_NORM_Y], [42, G_NORM_Y - 4], [83, G_NORM_Y + 5],
    [125, G_NORM_Y - 2], [167, G_NORM_Y - 2 - 9 * anim],
    [208, G_NORM_Y - 4 - 27 * anim], [257, G_NORM_Y - 8 - 55 * anim],
    [GW, endY],
  ];
}

// ── Log data ──────────────────────────────────────────────────────────────
const LOG_LINES = [
  { time: '10:14:02', level: 'INFO', text: 'Pipeline triggered by push to main (abc1234)' },
  { time: '10:14:03', level: 'INFO', text: 'Initializing build environment v4.2.1...' },
  { time: '10:14:05', level: 'INFO', text: 'Fetching dependencies from registry...' },
  { time: '10:14:08', level: 'INFO', text: 'Resolved 1,847 packages in 2.8s' },
  { time: '10:14:12', level: 'WARN', text: 'Deprecation: module "core-js@2.6" will be removed in v5' },
  { time: '10:14:15', level: 'INFO', text: 'Compiling TypeScript sources (strict mode)' },
  { time: '10:14:22', level: 'INFO', text: 'Bundling assets — 847 modules transformed' },
  { time: '10:14:28', level: 'INFO', text: 'Running unit tests... 342 suites found' },
  { time: '10:14:35', level: 'WARN', text: 'Snapshot mismatch in UserProfile.test.tsx — auto-updated' },
  { time: '10:14:40', level: 'INFO', text: 'Tests passed: 1,204 / 1,204 (0 failures)' },
  { time: '10:14:42', level: 'INFO', text: 'Generating source maps and optimizing bundles...' },
  { time: '10:14:45', level: 'FAIL', text: 'SyntaxError: Unexpected token in src/utils/parser.tsx:142' },
  { time: '10:14:46', level: 'INFO', text: 'Retrying build with fallback configuration...' },
  { time: '10:14:49', level: 'INFO', text: 'Fallback build successful — artifacts written to /dist' },
  { time: '10:14:50', level: 'INFO', text: 'Deploying to staging environment (us-east-1)...' },
  { time: '10:14:55', level: 'INFO', text: 'Deployment complete. Health check passed ✓' },
];

// ═══════════════════════════════════════════════════════════════════════════
// ── Soft Glow Border ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
interface GlowBorderProps {
  uid: string;
  frame: number;
  fps: number;
}

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
        strokeDasharray={`${POOL_LG} ${PERIMETER - POOL_LG}`}
        strokeDashoffset={off1}
        filter={`url(#gO-${uid})`} opacity={0.20 * p1}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#808080" strokeWidth={22}
        strokeDasharray={`${POOL_MD} ${PERIMETER - POOL_MD}`}
        strokeDashoffset={off2}
        filter={`url(#gM-${uid})`} opacity={0.24 * p2}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#a0a0a0" strokeWidth={10}
        strokeDasharray={`${POOL_SM} ${PERIMETER - POOL_SM}`}
        strokeDashoffset={off3}
        filter={`url(#gI-${uid})`} opacity={0.30 * p3}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#909090" strokeWidth={3} filter={`url(#gE-${uid})`} opacity={0.14}/>
      <rect x={PAD} y={PAD} width={CARD_W} height={CARD_H} rx={CARD_RX} ry={CARD_RX}
        fill="none" stroke="#b5b5b5" strokeWidth={0.5} opacity={0.18}/>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ── Grafana-style panel ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
interface GrafanaPanelProps {
  uid: string; title: string; subtitle: string; color: string;
  lPath: string; fPath: string; hPath: string; anim: number;
  dotX: number; dotY: number;
  yLabels: string[]; xLabels: string[];
  stat: string; statLabel: string; statArrow?: boolean; width?: number;
}

const GrafanaPanel: React.FC<GrafanaPanelProps> = ({
  uid, title, subtitle, color, lPath, fPath, hPath, anim, dotX, dotY,
  yLabels, xLabels, stat, statLabel, statArrow, width = 1305,
}) => {
  const PW = width;
  // Compact graph height — row 1 of a 2-row layout
  const PH = 230;
  const GM_LEFT = 58;
  const GM_TOP = 18;
  const GM_BOTTOM = 38;
  const GM_RIGHT = 14;
  const GAW = PW - GM_LEFT - GM_RIGHT;
  const GAH = PH - GM_TOP - GM_BOTTOM;
  const sx = (x: number) => GM_LEFT + (x / GW) * GAW;
  const sy = (y: number) => GM_TOP + (y / GH) * GAH;
  const scalePath = (path: string) =>
    path.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_, cmd, x, y) =>
      `${cmd} ${sx(parseFloat(x)).toFixed(1)} ${sy(parseFloat(y)).toFixed(1)}`);

  const scaledLPath = scalePath(lPath);
  const scaledFPath = scalePath(fPath)
    .replace(`L ${sx(GW).toFixed(1)} ${sy(GH).toFixed(1)}`, `L ${sx(GW).toFixed(1)} ${(GM_TOP + GAH).toFixed(1)}`)
    .replace(`L 0 ${sy(GH).toFixed(1)}`, `L ${GM_LEFT.toFixed(1)} ${(GM_TOP + GAH).toFixed(1)} Z`);
  const scaledHPath = scalePath(hPath);
  const scaledDotX = sx(dotX);
  const scaledDotY = sy(dotY);
  const yGridLines = [0, 0.25, 0.5, 0.75, 1].map(r => GM_TOP + r * GAH);

  return (
    <div style={{
      background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
      overflow: 'hidden', fontFamily: '"SF Mono","Fira Code",Consolas,monospace',
      width: PW, flexShrink: 0,
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 20px 12px', borderBottom: '1px solid #21262d',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 3, height: 20, background: color, borderRadius: 3 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#e6edf3', letterSpacing: '0.01em' }}>{title}</span>
        </div>
        <span style={{ fontSize: 13, color: '#6e7681' }}>{subtitle}</span>
      </div>

      {/* Stat area */}
      <div style={{ padding: '10px 20px 6px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 38, fontWeight: 700, color, letterSpacing: '-1.5px', lineHeight: 1, fontFamily: '"DM Sans",sans-serif' }}>{stat}</span>
        {statArrow && (
          <svg width={18} height={18} viewBox="0 0 18 18" style={{ opacity: anim, flexShrink: 0, marginBottom: 2 }}>
            <path d="M9 2 L15 9 H11.5 V16 H6.5 V9 H3 Z" fill={color} />
          </svg>
        )}
        <span style={{ fontSize: 13, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{statLabel}</span>
      </div>

      {/* Graph SVG */}
      <svg width={PW} height={PH} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`gf-gp-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2 * anim} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id={`gl-gp-${uid}`} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id={`clip-gp-${uid}`}>
            <rect x={GM_LEFT} y={GM_TOP} width={GAW} height={GAH} />
          </clipPath>
        </defs>
        {yGridLines.map((gy, i) => (
          <g key={i}>
            <line x1={GM_LEFT} y1={gy} x2={GM_LEFT + GAW} y2={gy} stroke="#21262d" strokeWidth={1} />
            <text x={GM_LEFT - 8} y={gy + 4} textAnchor="end" fontSize={12} fill="#6e7681">{yLabels[yGridLines.length - 1 - i]}</text>
          </g>
        ))}
        {xLabels.map((label, i) => {
          const xPos = GM_LEFT + (i / (xLabels.length - 1)) * GAW;
          return <text key={i} x={xPos} y={GM_TOP + GAH + 26} textAnchor="middle" fontSize={12} fill="#6e7681">{label}</text>;
        })}
        <line x1={GM_LEFT} y1={GM_TOP} x2={GM_LEFT} y2={GM_TOP + GAH} stroke="#30363d" strokeWidth={1} />
        <line x1={GM_LEFT} y1={GM_TOP + GAH} x2={GM_LEFT + GAW} y2={GM_TOP + GAH} stroke="#30363d" strokeWidth={1} />
        <g clipPath={`url(#clip-gp-${uid})`}>
          <path d={scaledFPath.replace('Z', '') + ` L ${(GM_LEFT + GAW).toFixed(1)} ${(GM_TOP + GAH).toFixed(1)} L ${GM_LEFT.toFixed(1)} ${(GM_TOP + GAH).toFixed(1)} Z`} fill={`url(#gf-gp-${uid})`} />
          <path d={scaledLPath} fill="none" stroke="#30363d" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={scaledHPath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" filter={`url(#gl-gp-${uid})`} opacity={anim} />
          <circle cx={scaledDotX} cy={scaledDotY} r={6 + 5 * anim} fill="none" stroke={color} strokeWidth={1.2} opacity={anim * 0.4} />
          <circle cx={scaledDotX} cy={scaledDotY} r={5} fill={color} filter={`url(#gl-gp-${uid})`} opacity={anim} />
        </g>
      </svg>

      {/* Legend footer */}
      <div style={{
        padding: '10px 20px 14px', borderTop: '1px solid #21262d',
        display: 'flex', gap: 26, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 2, background: '#30363d', borderRadius: 1 }} />
          <span style={{ fontSize: 11, color: '#6e7681' }}>baseline</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 2, background: color, borderRadius: 1, opacity: anim }} />
          <span style={{ fontSize: 11, color: '#6e7681' }}>anomaly</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6e7681' }}>last 30m</div>
      </div>
    </div>
  );
};

// ── Secondary mini Grafana panel (bars) ───────────────────────────────────
interface MiniBarPanelProps {
  uid: string; title: string; color: string; anim: number;
  barValues: number[]; barLabels: string[]; stat: string; statSuffix: string;
  width?: number; height?: number;
}

const MiniBarPanel: React.FC<MiniBarPanelProps> = ({ uid, title, color, anim, barValues, barLabels, stat, statSuffix, width = 491, height = 200 }) => {
  const PW = width;
  const PH = height;
  // header ~48px, stat ~52px → remaining for SVG
  const SVG_H = PH - 100;
  const BAR_H = SVG_H - 28; // leave room for x-labels
  const barW = 34;
  const gap = (PW - 28 - barValues.length * barW) / (barValues.length - 1);
  const maxVal = Math.max(...barValues);

  return (
    <div style={{
      background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
      overflow: 'hidden', fontFamily: '"SF Mono","Fira Code",Consolas,monospace', width: PW, flexShrink: 0,
    }}>
      <div style={{ padding: '12px 18px 8px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{title}</span>
      </div>
      <div style={{ padding: '10px 18px 0' }}>
        <span style={{ fontSize: 36, fontWeight: 700, color, letterSpacing: '-1px', fontFamily: '"DM Sans",sans-serif' }}>{stat}</span>
        <span style={{ fontSize: 13, color: '#6e7681', marginLeft: 6 }}>{statSuffix}</span>
      </div>
      <svg width={PW} height={SVG_H} style={{ display: 'block' }}>
        {barValues.map((v, i) => {
          const bh = (v / maxVal) * BAR_H * anim;
          const x = 14 + i * (barW + gap);
          const y = 8 + BAR_H - bh;
          const isLast = i === barValues.length - 1;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx={4}
                fill={isLast ? color : `${color}55`}
                style={{ filter: isLast ? `drop-shadow(0 0 5px ${color}88)` : 'none' }} />
              <text x={x + barW / 2} y={SVG_H - 7} textAnchor="middle" fontSize={11} fill="#6e7681">{barLabels[i]}</text>
            </g>
          );
        })}
        <line x1={14} y1={8 + BAR_H} x2={PW - 14} y2={8 + BAR_H} stroke="#30363d" strokeWidth={1} />
      </svg>
    </div>
  );
};

// ── Stat card mini ─────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string; color: string; delta?: string; anim: number }> = ({ label, value, color, delta, anim }) => (
  <div style={{
    background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
    padding: '16px 22px', fontFamily: '"SF Mono","Fira Code",Consolas,monospace', flex: 1,
  }}>
    <div style={{ fontSize: 12, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 700, color, letterSpacing: '-0.5px', fontFamily: '"DM Sans",sans-serif' }}>{value}</div>
    {delta && <div style={{ fontSize: 13, color, marginTop: 6, opacity: anim }}>↑ {delta}</div>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// ── Main component ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const PipelineSuccess: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Timings compressed to fit the 300-frame / 10s composition while preserving the
  // relative pacing of the four cards and leaving ~3s for the log reveal.
  const T_EXIT_1 = 2.0 * fps;
  const T_MID_1  = 2.25 * fps;
  const T_IN_1   = 2.8 * fps;
  const T_EXIT_2 = 4.5 * fps;
  const T_MID_2  = 4.75 * fps;
  const T_IN_2   = 5.3 * fps;
  const T_EXIT_3 = 6.8 * fps;
  const T_MID_3  = 7.05 * fps;
  const T_IN_3   = 7.6 * fps;

  const cameraBreathe = 1 + 0.012 * Math.sin(t * 0.55);
  const cameraY = 4 * Math.sin(t * 0.4 + 0.3);
  const cameraX = 2.5 * Math.cos(t * 0.35 + 1.1);

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

  // ── Card 1 transitions ────────────────────────────────────────────────
  const c1Opacity = frame < T_EXIT_1
    ? interpolate(frame, [0, 0.7 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [T_EXIT_1, T_MID_1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const c1ScaleBase = frame < T_EXIT_1
    ? interpolate(frame, [0, 0.9 * fps], [0.78, 1.0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [T_EXIT_1, T_MID_1], [1.0, 0.85], { easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const c1PushZoom = frame < T_EXIT_1
    ? interpolate(frame, [0.9 * fps, T_EXIT_1], [1.0, 1.05], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  const c1Scale = c1ScaleBase * c1PushZoom;
  const c1Y = frame < T_EXIT_1
    ? interpolate(frame, [0, 0.9 * fps], [20, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [T_EXIT_1, T_MID_1], [0, -30], { easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const c1Blur = frame < T_EXIT_1
    ? interpolate(frame, [0, 0.5 * fps], [6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(frame, [T_EXIT_1, T_MID_1], [0, 16], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ── Card 2 transitions ────────────────────────────────────────────────
  const c2InActive = frame >= T_MID_1 && frame < T_EXIT_2;
  const c2Opacity = c2InActive
    ? interpolate(frame, [T_MID_1, T_IN_1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_2
      ? interpolate(frame, [T_EXIT_2, T_MID_2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0;

  const c2ScaleBase = c2InActive
    ? interpolate(frame, [T_MID_1, T_IN_1], [1.14, 1.0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_2
      ? interpolate(frame, [T_EXIT_2, T_MID_2], [1.0, 0.84], { easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 1;
  const c2PushZoom = c2InActive
    ? interpolate(frame, [T_IN_1, T_EXIT_2], [1.0, 1.035], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  const c2Scale = c2ScaleBase * c2PushZoom;
  const c2Y = c2InActive
    ? interpolate(frame, [T_MID_1, T_IN_1], [35, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_2
      ? interpolate(frame, [T_EXIT_2, T_MID_2], [0, -30], { easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0;
  const c2Blur = c2InActive
    ? interpolate(frame, [T_MID_1, T_IN_1], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_2
      ? interpolate(frame, [T_EXIT_2, T_MID_2], [0, 16], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 14;

  // ── Card 3 transitions ────────────────────────────────────────────────
  const c3InActive = frame >= T_MID_2 && frame < T_EXIT_3;
  const c3Opacity = c3InActive
    ? interpolate(frame, [T_MID_2, T_IN_2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_3
      ? interpolate(frame, [T_EXIT_3, T_MID_3], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0;

  const c3ScaleBase = c3InActive
    ? interpolate(frame, [T_MID_2, T_IN_2], [1.14, 1.0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_3
      ? interpolate(frame, [T_EXIT_3, T_MID_3], [1.0, 0.84], { easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 1;
  const c3PushZoom = c3InActive
    ? interpolate(frame, [T_IN_2, T_EXIT_3], [1.0, 1.035], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  const c3Scale = c3ScaleBase * c3PushZoom;
  const c3Y = c3InActive
    ? interpolate(frame, [T_MID_2, T_IN_2], [35, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_3
      ? interpolate(frame, [T_EXIT_3, T_MID_3], [0, -30], { easing: Easing.in(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 0;
  const c3Blur = c3InActive
    ? interpolate(frame, [T_MID_2, T_IN_2], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : frame >= T_EXIT_3
      ? interpolate(frame, [T_EXIT_3, T_MID_3], [0, 16], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 14;

  // ── Card 4 transitions ────────────────────────────────────────────────
  const c4Opacity = interpolate(frame, [T_MID_3, T_IN_3], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const c4ScaleBase = interpolate(frame, [T_MID_3, T_IN_3], [1.14, 1.0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const c4PushZoom = interpolate(frame, [T_IN_3, T_IN_3 + 3 * fps], [1.0, 1.03], { easing: Easing.inOut(Easing.quad), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const c4Scale = c4ScaleBase * c4PushZoom;
  const c4Y = interpolate(frame, [T_MID_3, T_IN_3], [35, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const c4Blur = interpolate(frame, [T_MID_3, T_IN_3], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const livePulse = 0.65 + 0.35 * Math.sin(t * 3.5);

  // ── Error spike anim ─────────────────────────────────────────────────
  const ef = Math.max(0, frame - T_MID_1);
  const spikeAnim = interpolate(ef, [0, 0.65 * fps], [0, 1], { easing: Easing.out(Easing.back(1.15)), extrapolateRight: 'clamp' });
  const errPct = Math.round(interpolate(ef, [0.1 * fps, 1.0 * fps], [0, 180], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));

  const gPts = buildGraph(spikeAnim);
  const linePath = gPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fillPath = linePath + ` L ${GW} ${GH} L 0 ${GH} Z`;
  const [, psy] = gPts[5]; const [ppx, ppy] = gPts[6]; const [pex, pey] = gPts[7];
  const psx = gPts[5][0];
  const redPath = `M ${psx.toFixed(1)} ${psy.toFixed(1)} L ${ppx.toFixed(1)} ${ppy.toFixed(1)} L ${pex.toFixed(1)} ${pey.toFixed(1)}`;

  // ── Latency anim ─────────────────────────────────────────────────────
  const lf = Math.max(0, frame - T_MID_2);
  const latAnim = interpolate(lf, [0, 0.65 * fps], [0, 1], { easing: Easing.out(Easing.back(1.15)), extrapolateRight: 'clamp' });
  const latMs = Math.round(interpolate(lf, [0.1 * fps, 1.0 * fps], [0, 95], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));

  const lPts = buildLatencyGraph(latAnim);
  const lLinePath = lPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const lFillPath = lLinePath + ` L ${GW} ${GH} L 0 ${GH} Z`;
  const orangePath = lPts.slice(4).map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lpx, lpy] = lPts[7];

  // ── Log anim ─────────────────────────────────────────────────────────
  const logf = Math.max(0, frame - T_MID_3);
  const logAnim = interpolate(logf, [0, 0.65 * fps], [0, 1], { easing: Easing.out(Easing.back(1.15)), extrapolateRight: 'clamp' });

  // ── Shared styles ─────────────────────────────────────────────────────
  const cardShell: React.CSSProperties = {
    position: 'absolute', inset: 0, borderRadius: CARD_RX,
    background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(245,245,245,0.95) 100%)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.04), 0 20px 48px rgba(0,0,0,0.08), 0 48px 96px rgba(0,0,0,0.05)',
  };
  // Scaled padding: 44/56 → 52/68 to fill the larger card
  const innerPad: React.CSSProperties = {
    position: 'absolute', inset: 0, padding: '52px 68px',
    display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
  };

  // ── Header sub-component ──────────────────────────────────────────────
  const Header: React.FC<{ label: string; color: string; anim: number; subtitle?: string }> = ({ label, color: c, anim: a, subtitle }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: c, boxShadow: `0 0 ${5 + a * 12}px ${c}` }} />
          <span style={{ fontSize: 22, fontWeight: 700, color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        </div>
        {subtitle && <span style={{ fontSize: 19, color: '#aaa', marginLeft: 24 }}>{subtitle}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 18px', borderRadius: 20, background: `${c}0F`, border: `0.5px solid ${c}38` }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: livePulse }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: c, letterSpacing: '0.08em' }}>LIVE</span>
      </div>
    </div>
  );

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, fontFamily: '"DM Sans","SF Pro Display",Inter,system-ui,sans-serif',
      overflow: 'hidden',
    }}>
      <div style={{
        transform: `scale(${cameraBreathe}) translate(${cameraX}px, ${cameraY}px)`,
        willChange: 'transform',
      }}>
        <div style={{ position: 'relative', width: CARD_W, height: CARD_H }}>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* CARD 1 — Pipeline Success                                     */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: c1Opacity,
            transform: `scale(${c1Scale}) translateY(${c1Y}px)`,
            filter: `blur(${c1Blur}px)`,
            willChange: 'transform, opacity, filter',
          }}>
            <div style={cardShell} />
            <GlowBorder uid="s" frame={frame} fps={fps} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Scaled from 72 → 104 for the larger card */}
              <span style={{ color: '#1a1a1a', fontSize: 104, fontWeight: 700, letterSpacing: '-0.5px', textTransform: 'capitalize', userSelect: 'none' }}>
                pipeline success ✅
              </span>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* CARD 2 — Error Dashboard                                      */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: c2Opacity,
            transform: `scale(${c2Scale}) translateY(${c2Y}px)`,
            filter: `blur(${c2Blur}px)`,
            willChange: 'transform, opacity, filter',
          }}>
            <div style={cardShell} />
            <GlowBorder uid="e" frame={frame} fps={fps} />
            <div style={innerPad}>
              <Header label="Error Dashboard" color="#E24B4A" anim={spikeAnim} subtitle="prod · us-east-1 · last 30m" />

              {/* ROW 1 — graph full width */}
              <GrafanaPanel uid="err" title="HTTP 5xx Error Rate" subtitle="req/min" color="#E24B4A"
                lPath={linePath} fPath={fillPath} hPath={redPath} anim={spikeAnim}
                dotX={ppx} dotY={ppy}
                yLabels={['0','50','100','150','200']} xLabels={['-30m','-22m','-15m','-7m','now']}
                stat={`+${errPct}%`} statLabel="vs baseline" statArrow />

              {/* ROW 2 — 3 equal columns */}
              <div style={{ display: 'flex', gap: 20, marginTop: 20, flex: 1, minHeight: 0 }}>

                {/* Col 1 — bar chart */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <MiniBarPanel uid="err-bar" title="Errors / service" color="#E24B4A" anim={spikeAnim}
                    barValues={[12,8,34,19,91]} barLabels={['auth','api','db','cdn','parser']}
                    stat="91" statSuffix="peak/min" width={491} height={370} />
                </div>

                {/* Col 2 — two stat cards stacked */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <StatCard label="Affected endpoints" value="7" color="#E24B4A" anim={spikeAnim} delta={`${Math.round(spikeAnim * 3)} new`} />
                  <StatCard label="P99 response" value="2.4s" color="#F87171" anim={spikeAnim} />
                  <StatCard label="Error budget" value="−18%" color="#E24B4A" anim={spikeAnim} delta="this window" />
                </div>

                {/* Col 3 — alerts */}
                <div style={{
                  flex: 1, background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
                  padding: '16px 20px', fontFamily: '"SF Mono",Consolas,monospace', fontSize: 14,
                  color: '#6e7681', display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ color: '#e6edf3', fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Recent alerts</div>
                  {[
                    { t: '10:14:45', msg: 'Error spike · parser svc', c: '#F87171' },
                    { t: '10:14:38', msg: 'P99 threshold exceeded',   c: '#FBBF24' },
                    { t: '10:14:31', msg: 'DB conn pool exhausted',   c: '#F87171' },
                    { t: '10:14:22', msg: 'CDN origin timeout ×3',    c: '#FBBF24' },
                    { t: '10:14:15', msg: 'Auth retry storm detected', c: '#F87171' },
                  ].map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, opacity: spikeAnim }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: a.c, flexShrink: 0 }} />
                      <span style={{ color: '#6e7681', flexShrink: 0, fontSize: 13 }}>{a.t}</span>
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>{a.msg}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* CARD 3 — Latency Dashboard                                    */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: c3Opacity,
            transform: `scale(${c3Scale}) translateY(${c3Y}px)`,
            filter: `blur(${c3Blur}px)`,
            willChange: 'transform, opacity, filter',
          }}>
            <div style={cardShell} />
            <GlowBorder uid="l" frame={frame} fps={fps} />
            <div style={innerPad}>
              <Header label="Latency Dashboard" color="#F59E0B" anim={latAnim} subtitle="prod · us-east-1 · last 30m" />

              {/* ROW 1 — graph full width */}
              <GrafanaPanel uid="lat" title="P95 Latency (ms)" subtitle="milliseconds" color="#F59E0B"
                lPath={lLinePath} fPath={lFillPath} hPath={orangePath} anim={latAnim}
                dotX={lpx} dotY={lpy}
                yLabels={['0','50','100','150','200']} xLabels={['-30m','-22m','-15m','-7m','now']}
                stat={`+${latMs}ms`} statLabel="above threshold" statArrow />

              {/* ROW 2 — 3 equal columns */}
              <div style={{ display: 'flex', gap: 20, marginTop: 20, flex: 1, minHeight: 0 }}>

                {/* Col 1 — bar chart */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <MiniBarPanel uid="lat-bar" title="Latency / region" color="#F59E0B" anim={latAnim}
                    barValues={[42,38,67,55,119]} barLabels={['eu-w','ap-s','us-w','us-c','us-e']}
                    stat="119" statSuffix="ms p95" width={491} height={370} />
                </div>

                {/* Col 2 — stat cards */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <StatCard label="SLO breach" value="3.2%" color="#F59E0B" anim={latAnim} delta={`${Math.round(latAnim * 12)}% window`} />
                  <StatCard label="Apdex score" value="0.81" color="#FBBF24" anim={latAnim} />
                  <StatCard label="P50 latency" value="58ms" color="#F59E0B" anim={latAnim} delta="↑ 12ms" />
                </div>

                {/* Col 3 — degraded services */}
                <div style={{
                  flex: 1, background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
                  padding: '16px 20px', fontFamily: '"SF Mono",Consolas,monospace',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ color: '#e6edf3', fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Degraded services</div>
                  {[
                    { svc: 'api-gateway',   p95: '187ms', trend: '↑' },
                    { svc: 'auth-service',  p95: '143ms', trend: '↑' },
                    { svc: 'search-svc',    p95: '98ms',  trend: '→' },
                    { svc: 'media-resizer', p95: '74ms',  trend: '↑' },
                    { svc: 'notif-worker',  p95: '61ms',  trend: '→' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, opacity: latAnim }}>
                      <span style={{ color: '#9ca3af', fontSize: 13 }}>{s.svc}</span>
                      <span style={{ color: '#F59E0B', fontWeight: 600, fontSize: 13 }}>{s.trend} {s.p95}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* CARD 4 — System Logs                                          */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: c4Opacity,
            transform: `scale(${c4Scale}) translateY(${c4Y}px)`,
            filter: `blur(${c4Blur}px)`,
            willChange: 'transform, opacity, filter',
          }}>
            <div style={cardShell} />
            <GlowBorder uid="lg" frame={frame} fps={fps} />
            <div style={innerPad}>
              <Header label="Logs" color="#3B82F6" anim={logAnim} />
              <div style={{
                flex: 1, background: '#111827', borderRadius: 18, padding: '28px 40px',
                display: 'flex', flexDirection: 'column', gap: 13, overflow: 'hidden',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.25)', border: '1px solid #374151',
                fontFamily: '"SF Mono","Fira Code","JetBrains Mono",Consolas,monospace',
              }}>
                {LOG_LINES.map((line, i) => {
                  const lineDelay = 0.25 * fps + i * 0.17 * fps;
                  const lineTime = Math.max(0, logf - lineDelay);
                  const lineOpacity = interpolate(lineTime, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
                  const translateY = interpolate(lineTime, [0, 8], [8, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
                  if (lineOpacity === 0) return null;
                  const levelColor = line.level === 'FAIL' ? '#F87171' : line.level === 'WARN' ? '#FBBF24' : '#60A5FA';
                  return (
                    <div key={i} style={{ display: 'flex', gap: 26, fontSize: 18, opacity: lineOpacity, transform: `translateY(${translateY}px)` }}>
                      <span style={{ color: '#4B5563', flexShrink: 0 }}>{line.time}</span>
                      <span style={{ color: levelColor, width: 56, flexShrink: 0, fontWeight: 700 }}>{line.level}</span>
                      <span style={{ color: '#D1D5DB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.text}</span>
                    </div>
                  );
                })}
                {logf > 0 && (
                  <div style={{ width: 12, height: 24, background: '#6B7280', opacity: livePulse, borderRadius: 2, marginTop: 4 }} />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
