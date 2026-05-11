// components/Dashboard.tsx
import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface DashboardProps {
  data: {
    title: string;
    metrics: Array<{
      label: string;
      value: string;
      unit: string;
      trend?: 'up' | 'down';
    }>;
    graph?: React.ReactNode;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const frame = useCurrentFrame();

  // Animation d'entrée
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        padding: 24,
        opacity,
        fontSize: 12,
        fontFamily: 'monospace',
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
        {data.title}
      </div>

      {/* Grid de métriques */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {data.metrics.map((metric, idx) => (
          <MetricCard key={idx} metric={metric} />
        ))}
      </div>

      {/* Graph placeholder */}
      {data.graph && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            padding: 12,
            marginTop: 12,
          }}
        >
          {data.graph}
        </div>
      )}
    </div>
  );
};

const MetricCard: React.FC<{ metric: any }> = ({ metric }) => {
  const isNegative = metric.trend === 'down';

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        padding: 12,
        fontSize: 11,
      }}
    >
      <div style={{ color: '#999', marginBottom: 4 }}>{metric.label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: isNegative ? '#ef4444' : '#10b981',
          fontFamily: 'monospace',
        }}
      >
        {metric.value} {metric.unit}
      </div>
    </div>
  );
};