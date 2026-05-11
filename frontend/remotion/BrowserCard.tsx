// components/BrowserCard.tsx
import React from 'react';
import { useCurrentFrame, interpolate, interpolateColors, Easing } from 'remotion';
import { TabBar } from './TabBar';
import { Dashboard } from './Dashboard';
import { CI_TAB, DATADOG_TAB, GRAFANA_TAB, SENTRY_TAB } from './Tabs';

interface BrowserCardProps {
  activeTab: string;
}

export const BrowserCard: React.FC<BrowserCardProps> = ({ activeTab }) => {
  const frame = useCurrentFrame();

  // Animation d'apparition initiale
  const scale = interpolate(
    frame,
    [0, 30],
    [0.8, 1],
    { easing: Easing.out(Easing.cubic) }
  );

  const borderColor = interpolateColors(
    frame % 60,
    [0, 30, 60],
    [
      '#3b82f6cc',
      '#8b5cf6cc',
      '#3b82f6cc',
    ]
  );

  return (
    <div
      style={{
        width: 800,
        height: 500,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        border: `3px solid ${borderColor}`,
        overflow: 'hidden',
        transform: `scale(${scale})`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Chrome-like header */}
      <div
        style={{
          background: '#f3f3f3',
          borderBottom: '1px solid #d0d0d0',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Chrome buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ff5f56',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#febc2e',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#27c93f',
            }}
          />
        </div>

        {/* Address bar */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: '6px 12px',
            marginLeft: 20,
            fontSize: 12,
            color: '#666',
          }}
        >
          📊 monitoring.dashboards
        </div>
      </div>

      {/* Tabs */}
      <TabBar activeTab={activeTab} />

      {/* Dashboard Content */}
      <div
        style={{
          flex: 1,
          background: '#0a0e27',
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {activeTab === 'ci' && <Dashboard data={CI_TAB} />}
        {activeTab === 'datadog' && <Dashboard data={DATADOG_TAB} />}
        {activeTab === 'grafana' && <Dashboard data={GRAFANA_TAB} />}
        {activeTab === 'sentry' && <Dashboard data={SENTRY_TAB} />}
      </div>
    </div>
  );
};