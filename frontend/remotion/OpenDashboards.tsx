import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

// Durée totale de la séquence (en frames). À 30fps → ~8 secondes.
const SEQUENCE_DURATION = 240;

export const OpenDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Gestion du timing des "actes" ------------------------------------------------
  // 0‑30   : Entrée premium de la card (scale + blur)
  // 30‑70  : Affichage onglet "ci: success"
  // 70‑95  : Déplacement curseur vers Datadog + zoom sur l’onglet
  // 95‑140 : Dashboard Datadog (graph Error Rate qui dégrade)
  // 140‑165: Déplacement curseur vers Grafana + zoom
  // 165‑210: Dashboard Grafana (graph Latency qui dégrade)
  // 210‑235: Déplacement curseur vers Sentry
  // 235‑SEQUENCE_DURATION : Dashboard Sentry (liste d’erreurs denses)

  const entryProgress = Math.min(frame / 30, 1);

  const isCI = frame >= 30 && frame < 70;
  const isMovingToDatadog = frame >= 70 && frame < 95;
  const isDatadog = frame >= 95 && frame < 140;
  const isMovingToGrafana = frame >= 140 && frame < 165;
  const isGrafana = frame >= 165 && frame < 210;
  const isMovingToSentry = frame >= 210 && frame < 235;
  const isSentry = frame >= 235;

  // --- Positions des onglets (en pixels relatifs à la card) ---------------------------
  const tabs = [
    { id: 'ci', label: 'ci: success', x: 80 },
    { id: 'datadog', label: 'datadog', x: 220 },
    { id: 'grafana', label: 'grafana', x: 360 },
    { id: 'sentry', label: 'sentry', x: 500 },
  ];

  // Position X du curseur (avec animation spring pour un mouvement "premium")
  let targetTabIndex = 0;
  if (isCI) targetTabIndex = 0;
  else if (isMovingToDatadog || isDatadog) targetTabIndex = 1;
  else if (isMovingToGrafana || isGrafana) targetTabIndex = 2;
  else if (isMovingToSentry || isSentry) targetTabIndex = 3;

  const cursorSpring = spring({
    frame: frame - (targetTabIndex === 0 ? 0 : targetTabIndex === 1 ? 70 : targetTabIndex === 2 ? 140 : 210),
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  const cursorX = interpolate(cursorSpring, [0, 1], [tabs[0].x, tabs[targetTabIndex].x]);

  // --- Helpers d’animation ----------------------------------------------------------
  const getZoomForTab = (index: number) => {
    const isZooming =
      (isMovingToDatadog && index === 1) ||
      (isMovingToGrafana && index === 2) ||
      (isMovingToSentry && index === 3);
    if (!isZooming) return 1;
    // Zoom qui pulse légèrement pendant le déplacement
    return 1 + 0.08 * Math.sin((frame % 20) / 2);
  };

  const getActiveFill = (index: number) => {
    if (isCI && index === 0) return 'white';
    if (isDatadog && index === 1) return 'white';
    if (isGrafana && index === 2) return 'white';
    if (isSentry && index === 3) return 'white';
    return '#e5e7eb';
  };

  // Fond façon halos lumineux (inspiration antigravity): deux radiales qui se déplacent lentement
  const t = frame / fps;
  const halo1X = 50 + 18 * Math.sin(t * 0.8);
  const halo1Y = 42 + 14 * Math.cos(t * 0.6);
  const halo2X = 60 + 22 * Math.sin(t * 1.1 + 0.7);
  const halo2Y = 64 + 16 * Math.cos(t * 0.9 + 1.2);
  const baseAngle = interpolate(frame % 480, [0, 480], [0, 360]);
  const backgroundLayers = `
    radial-gradient(60% 70% at ${halo1X}% ${halo1Y}%, rgba(245,245,245,0.9), rgba(245,245,245,0) 70%),
    radial-gradient(50% 60% at ${halo2X}% ${halo2Y}%, rgba(230,230,230,0.85), rgba(230,230,230,0) 70%),
    linear-gradient(${baseAngle}deg, #f8f8f8 0%, #eeeeee 45%, #fafafa 100%)
  `;

  // Bordure animée du navigateur, dans le même thème gris doux
  const borderAngle = (t * 40) % 360;
  const borderGradient = `linear-gradient(${borderAngle}deg, #f5f5f5 0%, #dcdcdc 40%, #f5f5f5 80%)`;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: backgroundLayers,
        backgroundSize: '200% 200%',
        backgroundPosition: `${50 + 10 * Math.sin(t * 0.5)}% ${50 + 8 * Math.cos(t * 0.4)}%`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Carte navigateur Chrome */}
      <div
        style={{
          width: 920,
          height: 620,
          background: `linear-gradient(white, white) padding-box, ${borderGradient} border-box`,
          borderRadius: 14,
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.20)',
          border: '2px solid transparent',
          transform: `scale(${interpolate(entryProgress, [0, 1], [0.92, 1])})`,
          opacity: entryProgress,
          filter: `blur(${interpolate(entryProgress, [0, 1], [10, 0])}px)`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          // Animer la position du gradient de bordure pour un effet "vivant"
          backgroundClip: 'padding-box',
          // On simule une bordure animée via un pseudo-élément non disponible en React inline,
          // donc on utilise un gradient animé sur un div enfant derrière la card si besoin,
          // mais ici on garde une bordure simple avec ombre dynamique.
        }}
      >
        {/* Barre d'onglets Chrome */}
        <div
          style={{
            display: 'flex',
            background: '#f1f5f9',
            borderRadius: '14px 14px 0 0',
            padding: '10px 10px 0 10px',
            gap: 6,
            height: 44,
            alignItems: 'flex-end',
            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.05)',
          }}
        >
          {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              style={{
                padding: '8px 18px',
                background: getActiveFill(idx),
                borderRadius: '10px 10px 0 0',
                fontSize: 13,
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontWeight: 500,
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderBottom: 'none',
                position: 'relative',
                transform: `scale(${getZoomForTab(idx)})`,
                transition: 'transform 0.1s linear',
                boxShadow: getActiveFill(idx) === 'white' ? '0 -2px 0 white' : 'none',
              }}
            >
              {tab.label}
              {idx === 0 && isCI && (
                <span style={{ marginLeft: 6, color: '#22c55e', fontSize: 10 }}>●</span>
              )}
            </div>
          ))}
        </div>

        {/* Contenu du dashboard */}
        <div style={{ flex: 1, padding: 0, background: '#ffffff', position: 'relative' }}>
          {/* Fade transition entre les dashboards */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: isCI ? 1 : 0,
              transition: 'opacity 0.2s',
              pointerEvents: isCI ? 'auto' : 'none',
            }}
          >
            <CIDashboard frame={frame} />
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: isDatadog ? 1 : 0,
              transition: 'opacity 0.2s',
              pointerEvents: isDatadog ? 'auto' : 'none',
            }}
          >
            <DatadogDashboard frame={frame} startFrame={95} />
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: isGrafana ? 1 : 0,
              transition: 'opacity 0.2s',
              pointerEvents: isGrafana ? 'auto' : 'none',
            }}
          >
            <GrafanaDashboard frame={frame} startFrame={165} />
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: isSentry ? 1 : 0,
              transition: 'opacity 0.2s',
              pointerEvents: isSentry ? 'auto' : 'none',
            }}
          >
            <SentryDashboard frame={frame} />
          </div>
        </div>
      </div>

      {/* Curseur (pointeur souris) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          // La card est centrée (50% / 50%). On ajoute les offsets relatifs à la card.
          // Card width = 920, donc centre card = 50% + 0.
          // On décale de -460 (moitié largeur) + cursorX, et on monte à la hauteur des onglets.
          transform: `translate(calc(-50% + ${cursorX - 460}px), calc(-50% + 210px))`,
          width: 22,
          height: 22,
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z"
            fill="#1e293b"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Composants de dashboards (denses, techniques, difficiles à lire rapidement)
// -----------------------------------------------------------------------------

function CIDashboard({ frame }: { frame: number }) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', fontSize: 24, fontWeight: 'bold' }}>
          ✓
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>Build Successful</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Commit <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>a1b2c3d</code> • main branch</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, flex: 1 }}>
        {['Unit Tests', 'Linting', 'Type Check'].map((label) => (
          <div key={label} style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>Passed</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatadogDashboard({ frame, startFrame }: { frame: number; startFrame: number }) {
  // Progression du graph (0 → 1 sur 45 frames)
  const progress = Math.max(0, Math.min(1, (frame - startFrame) / 45));

  return (
    <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Error Rate Monitoring</div>
        <div style={{ fontSize: 12, color: '#dc2626', background: '#fee2e2', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>● LIVE</div>
      </div>

      {/* Graph dense */}
      <div style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, position: 'relative', minHeight: 0 }}>
        {/* Grille */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#f3f4f6 1px, transparent 1px), linear-gradient(90deg, #f3f4f6 1px, transparent 1px)', backgroundSize: '50px 50px', opacity: 0.6 }} />
        
        <svg width="100%" height="80%" viewBox="0 0 800 300" style={{ position: 'relative', zIndex: 1 }}>
          <defs>
            <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dc2626" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Zone sous la courbe qui s'accumule */}
          <path
            d={`M 0,300 L 0,${300 - progress * 240} ${Array.from({ length: 20 }, (_, i) => {
              const x = (i + 1) * 40;
              const y = 300 - progress * ((i + 1) * 12 + Math.sin(i) * 20);
              return `L ${x},${y}`;
            }).join(' ')} L 800,300 Z`}
            fill="url(#errGrad)"
          />
          {/* Ligne principale */}
          <path
            d={`M 0,260 ${Array.from({ length: 20 }, (_, i) => {
              const x = (i + 1) * 40;
              const y = 260 - progress * ((i + 1) * 12 + Math.sin(i) * 20);
              return `L ${x},${y}`;
            }).join(' ')}`}
            stroke="#dc2626"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
          />
          {/* Points de données */}
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx={(i + 1) * 65} cy={260 - progress * ((i + 1) * 20)} r="4" fill="#dc2626" stroke="white" strokeWidth="1" />
          ))}
        </svg>

        {/* Métriques denses en bas du graph */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px', fontSize: 11 }}>
              <div style={{ color: '#6b7280', marginBottom: 4 }}>host-{['us-east', 'eu-west', 'ap-south'][i % 3]}-{100 + i}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>{(progress * (60 + i * 8)).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats supplémentaires très denses */}
      <div style={{ height: 110, marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {['p95 Latency', 'Throughput', 'Apdex', 'Error Budget'].map((m, i) => (
          <div key={m} style={{ background: '#f3f4f6', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{m}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: i % 2 === 0 ? '#dc2626' : '#111827' }}>
              {i === 0 ? (150 + progress * 400).toFixed(0) + 'ms' : i === 1 ? (900 - progress * 200).toFixed(0) + '/s' : i === 2 ? (0.98 - progress * 0.5).toFixed(2) : (90 - progress * 80).toFixed(0) + '%'}
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>Last 5m • avg</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrafanaDashboard({ frame, startFrame }: { frame: number; startFrame: number }) {
  const progress = Math.max(0, Math.min(1, (frame - startFrame) / 45));

  return (
    <div style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace' }}>
      {/* Header Grafana */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Latency Overview <span style={{ color: '#94a3b8', fontWeight: 400 }}>[Production]</span></div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Now: 10:{(frame % 60).toString().padStart(2, '0')}</div>
      </div>

      <div style={{ flex: 1, padding: 20, display: 'grid', gridTemplateRows: '2fr 1fr', gap: 16 }}>
        {/* Graph principal avec pics de latence */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: 16, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12 }}>
            <span style={{ color: '#60a5fa' }}>p99 Latency (ms)</span>
            <span style={{ color: '#f87171' }}>Critical &gt; 2000ms</span>
          </div>

          <svg width="100%" height="200" viewBox="0 0 800 200" style={{ borderBottom: '1px solid #334155', borderLeft: '1px solid #334155' }}>
            {/* Grille dense */}
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1={i * 100} y1="0" x2={i * 100} y2="200" stroke="#334155" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 10 }, (_, i) => (
              <line key={i} x1="0" y1={i * 20} x2="800" y2={i * 20} stroke="#334155" strokeWidth="0.5" />
            ))}

            {/* Courbe de latence qui empire (pics plus hauts) */}
            <path
              d={`M 0,180 ${Array.from({ length: 40 }, (_, i) => {
                const x = (i + 1) * 20;
                // Bruit + dégradation progressive
                const base = 180 - Math.sin(i * 0.4) * 30;
                const degrade = progress * (i * 4);
                const spike = i > 30 ? progress * (i - 30) * 5 : 0;
                const y = Math.max(20, base - degrade - spike);
                return `L ${x},${y}`;
              }).join(' ')} L 800,200 Z`}
              fill="#450a0a"
              fillOpacity="0.35"
              stroke="#ef4444"
              strokeWidth="2"
            />

            {/* Labels denses */}
            {Array.from({ length: 6 }, (_, i) => (
              <text key={i} x={i * 130 + 40} y="190" fill="#94a3b8" fontSize="10">
                {i * 10}m
              </text>
            ))}
          </svg>

          {/* Légende très dense */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, flexWrap: 'wrap', color: '#cbd5e1' }}>
            {['API Gateway', 'Auth Svc', 'DB Primary', 'Cache Redis', 'Worker Pool', 'Network'].map((svc, i) => (
              <div key={svc} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, background: ['#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#f87171'][i % 6], borderRadius: 2 }} />
                <span style={{ color: '#94a3b8' }}>{svc}</span>
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>{(80 + progress * (i * 150)).toFixed(0)}ms</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau de logs très dense */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Live Query Log</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 10, overflow: 'hidden' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ background: progress > 0.6 && i > 3 ? '#2d1b1b' : '#0f172a', padding: '8px', borderRadius: 4, border: `1px solid ${progress > 0.6 && i > 3 ? '#7f1d1d' : '#334155'}`, color: progress > 0.6 && i > 3 ? '#fca5a5' : '#cbd5e1' }}>
                <div style={{ color: '#64748b', marginBottom: 4 }}>SELECT * FROM table_{i + 1}...</div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{progress > 0.6 && i > 3 ? 'TIMEOUT' : '200 OK'}</div>
                <div style={{ color: '#64748b' }}>lat: {(progress * (300 + i * 50)).toFixed(0)}ms</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SentryDashboard({ frame }: { frame: number }) {
  return (
    <div style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, sans-serif' }}>
      {/* Header Sentry */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1f2937' }}>Issues</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['All', 'Unresolved', 'Errors', 'Performance'].map((f, i) => (
            <button
              key={f}
              style={{
                padding: '6px 14px',
                border: '1px solid #e5e7eb',
                background: i === 2 ? '#2563eb' : '#fff',
                color: i === 2 ? '#fff' : '#374151',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Liste d'erreurs dense */}
      <div style={{ flex: 1, overflow: 'hidden', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const isCritical = i < 3;
            const isDegrading = i < 2;
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 2fr 1fr 1fr 1fr 110px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  background: isCritical ? '#fef2f2' : '#fff',
                  borderLeft: `4px solid ${isCritical ? '#dc2626' : '#e5e7eb'}`,
                }}
              >
                <div style={{ fontSize: 20, textAlign: 'center' }}>{isCritical ? '🔥' : '⚠️'}</div>

                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2, fontFamily: 'monospace' }}>
                    {isCritical ? 'TypeError: Cannot read prop "data" of undefined' : 'Warning: Deprecated API usage'}
                    <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 12 }}> • src/components/{['DataGrid', 'Auth', 'API', 'Utils', 'Store'][i % 5]}.tsx:{10 + i}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {isCritical ? 'High impact • Affecting 40% of sessions' : 'Low impact • 3 events'}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  <div style={{ fontWeight: 600, color: '#374151' }}>First seen</div>
                  <div>{2 + i}h ago</div>
                </div>

                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  <div style={{ fontWeight: 600, color: '#374151' }}>Events</div>
                  <div style={{ color: isDegrading ? '#dc2626' : '#374151', fontWeight: 700 }}>
                    {isDegrading ? (1500 + i * 400).toLocaleString() : i * 8}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  <div style={{ fontWeight: 600, color: '#374151' }}>Users</div>
                  <div>{isDegrading ? (1200 + i * 300) : i * 5}</div>
                </div>

                <div>
                  <button
                    style={{
                      padding: '6px 14px',
                      background: isCritical ? '#fee2e2' : '#f3f4f6',
                      color: isCritical ? '#dc2626' : '#374151',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {isCritical ? 'Resolve' : 'Ignore'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer stats très denses */}
      <div style={{ height: 88, background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: 16, display: 'flex', gap: 32 }}>
        {[
          { label: 'Total Events (24h)', value: '28,492', trend: '+18%' },
          { label: 'Affected Users', value: '4,120', trend: '+5%' },
          { label: 'Crash Free Rate', value: '91.4%', trend: '-3.2%' },
          { label: 'Avg Response', value: '1.8s', trend: '+420ms' },
        ].map((stat) => (
          <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: stat.trend.includes('-') || (stat.trend.includes('+') && !stat.label.includes('Crash')) ? '#dc2626' : '#16a34a' }}>
              {stat.trend} <span style={{ color: '#9ca3af' }}>vs yesterday</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OpenDashboard;