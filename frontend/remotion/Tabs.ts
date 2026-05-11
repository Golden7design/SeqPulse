// components/Tabs.ts
export const CI_TAB = {
  title: 'Pipeline Status: ✅ All Checks Passed',
  metrics: [
    { label: 'Build Time', value: '2m 34s', unit: 'elapsed' },
    { label: 'Tests Passed', value: '1247', unit: '/ 1247' },
    { label: 'Coverage', value: '94.3', unit: '%' },
    { label: 'Lint Issues', value: '0', unit: 'errors' },
  ],
};

export const DATADOG_TAB = {
  title: 'Error Rate Dashboard - Production',
  metrics: [
    { label: '5m Error Rate', value: '0.023', unit: '%', trend: 'down' as const },
    { label: '1h Errors', value: '8.3K', unit: 'events', trend: 'down' as const },
    { label: 'Critical', value: '342', unit: 'alerts', trend: 'down' as const },
    { label: 'p99 Latency', value: '1.247', unit: 's', trend: 'down' as const },
  ],
};

export const GRAFANA_TAB = {
  title: 'Latency Metrics - System Health',
  metrics: [
    { label: 'p50 Latency', value: '45.2', unit: 'ms' },
    { label: 'p95 Latency', value: '234.5', unit: 'ms', trend: 'down' as const },
    { label: 'p99 Latency', value: '891.3', unit: 'ms', trend: 'down' as const },
    { label: 'Max Latency', value: '2.341', unit: 's', trend: 'down' as const },
  ],
};

export const SENTRY_TAB = {
  title: 'New Errors - Last 24h',
  metrics: [
    { label: 'New Events', value: '127', unit: 'errors', trend: 'down' as const },
    { label: 'Unique Issues', value: '14', unit: 'distinct' },
    { label: 'Affected Users', value: '89', unit: 'users' },
    { label: 'Resolution Rate', value: '78.2', unit: '%' },
  ],
};