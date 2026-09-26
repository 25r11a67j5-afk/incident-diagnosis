import { Monitor, ExternalLink, Activity, TrendingUp, AlertTriangle, Clock, Server } from 'lucide-react';

// -------------------------------------------------------------------------
// BACKEND INTEGRATION POINT:
// Set GRAFANA_URL to your real Grafana dashboard URL.
// e.g., 'http://localhost:3000/d/your-dashboard-id?orgId=1&refresh=10s'
// This variable is also exported from controlPlaneService.js for central config.
// -------------------------------------------------------------------------
import { GRAFANA_URL } from '../services/controlPlaneService.js';

/**
 * MonitoringPanel — system health and metrics display.
 * Can later open a real Grafana dashboard.
 * Props:
 *   metrics — { systemHealth, requestRate, errorRate, incidentCount,
 *               avgLatencyMs, p99LatencyMs, uptimePercent, monitoringStatus }
 */
export default function MonitoringPanel({ metrics }) {
  const {
    systemHealth = 0,
    requestRate = 0,
    errorRate = 0,
    incidentCount = 0,
    avgLatencyMs = 0,
    p99LatencyMs = 0,
    uptimePercent = 0,
    monitoringStatus = 'UNKNOWN',
  } = metrics || {};

  const handleOpenMonitoring = () => {
    if (GRAFANA_URL) {
      window.open(GRAFANA_URL, '_blank', 'noopener,noreferrer');
    } else {
      // BACKEND: Replace with real Grafana URL in GRAFANA_URL constant
      // in src/services/controlPlaneService.js
      alert(
        'Grafana URL not configured.\n\nTo connect, set the GRAFANA_URL variable in:\nsrc/services/controlPlaneService.js\n\ne.g., http://localhost:3000/d/your-dashboard-id'
      );
    }
  };

  const healthColor =
    systemHealth >= 90 ? '#22c55e' : systemHealth >= 70 ? '#f59e0b' : '#ef4444';

  const tiles = [
    { label: 'System Health', value: `${systemHealth}%`, icon: <Server size={16} />, color: healthColor },
    { label: 'Request Rate', value: `${requestRate.toLocaleString()}/min`, icon: <Activity size={16} />, color: '#60a5fa' },
    { label: 'Error Rate', value: `${errorRate}%`, icon: <AlertTriangle size={16} />, color: errorRate > 5 ? '#ef4444' : '#f59e0b' },
    { label: 'Active Incidents', value: incidentCount, icon: <AlertTriangle size={16} />, color: '#f59e0b' },
    { label: 'Avg Latency', value: `${avgLatencyMs}ms`, icon: <Clock size={16} />, color: '#a78bfa' },
    { label: 'P99 Latency', value: `${p99LatencyMs}ms`, icon: <TrendingUp size={16} />, color: '#a78bfa' },
    { label: 'Uptime', value: `${uptimePercent}%`, icon: <Activity size={16} />, color: '#22c55e' },
    { label: 'Monitor Status', value: monitoringStatus, icon: <Monitor size={16} />, color: '#22c55e' },
  ];

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Monitor size={18} className="cp-panel-icon" />
        <h2>Monitoring</h2>
        <span className="cp-badge cp-sev-low">{monitoringStatus}</span>
        <button
          className="cp-btn cp-btn-outline cp-btn-sm"
          onClick={handleOpenMonitoring}
          style={{ marginLeft: 'auto' }}
        >
          <ExternalLink size={13} /> Open Monitoring
        </button>
      </div>

      <p className="cp-muted" style={{ marginBottom: 16, fontSize: 12 }}>
        ⓘ Real-time metrics. To connect Grafana, set <code>GRAFANA_URL</code> in{' '}
        <code>src/services/controlPlaneService.js</code>.
      </p>

      <div className="cp-monitor-grid">
        {tiles.map((t) => (
          <div key={t.label} className="cp-monitor-tile">
            <div className="cp-monitor-icon" style={{ color: t.color }}>
              {t.icon}
            </div>
            <span className="cp-muted" style={{ fontSize: 11 }}>{t.label}</span>
            <strong style={{ color: t.color, fontSize: 18 }}>{t.value}</strong>
          </div>
        ))}
      </div>

      {/* System health bar */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="cp-muted" style={{ fontSize: 12 }}>Overall System Health</span>
          <span style={{ color: healthColor, fontSize: 12, fontWeight: 600 }}>{systemHealth}%</span>
        </div>
        <div className="cp-bar-track">
          <div className="cp-bar-fill" style={{ width: `${systemHealth}%`, background: healthColor }} />
        </div>
      </div>
    </div>
  );
}
