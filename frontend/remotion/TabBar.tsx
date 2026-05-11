// components/TabBar.tsx
import React from 'react';

interface TabBarProps {
  activeTab: string;
}

const tabs = [
  { id: 'ci', label: 'CI: success' },
  { id: 'datadog', label: 'datadog' },
  { id: 'grafana', label: 'grafana' },
  { id: 'sentry', label: 'sentry' },
];

export const TabBar: React.FC<TabBarProps> = ({ activeTab }) => {
  return (
    <div
      style={{
        display: 'flex',
        background: '#1a1f3a',
        borderBottom: '1px solid #2d3748',
        gap: 0,
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: activeTab === tab.id ? 600 : 400,
            color: activeTab === tab.id ? '#fff' : '#999',
            background:
              activeTab === tab.id ? '#2d3748' : 'transparent',
            borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
};