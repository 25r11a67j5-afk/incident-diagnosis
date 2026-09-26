import { Monitor, ExternalLink, Activity, AlertTriangle, Clock, Server, TrendingUp } from "lucide-react";
import { GRAFANA_URL } from "../services/controlPlaneService.js";

/**
 * Monitoring — Grafana placeholder + system health tiles.
 * To connect real Grafana, set GRAFANA_URL in controlPlaneService.js.
 * Props:
 *   metrics — optional monitoring metrics object
 */
export default function Monitoring({ metrics }) {
  const {
    systemHealth = 87,
    requestRate = 4320,
    errorRate = 2.3,
    incidentCount = 2,
    avgLatencyMs = 148,
    p99LatencyMs = 890,
    uptimePercent = 99.71,
    monitoringStatus = "ACTIVE",
  } = metrics || {};

  const handleOpen = () => {
    const url = GRAFANA_URL || "http://localhost:3001";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const healthColor =
    systemHealth >= 90 ? "#22c55e" : systemHealth >= 70 ? "#f59e0b" : "#ef4444";

  const tiles = [
    { label: "System Health",   value: `${systemHealth}%`,             icon: <Server size={14} />,     color: healthColor },
    { label: "Request Rate",    value: `${requestRate.toLocaleString()}/min`, icon: <Activity size={14} />,  color: "#60a5fa" },
    { label: "Error Rate",      value: `${errorRate}%`,                icon: <AlertTriangle size={14} />, color: errorRate > 5 ? "#ef4444" : "#f59e0b" },
    { label: "Incidents",       value: incidentCount,                  icon: <AlertTriangle size={14} />, color: "#f59e0b" },
    { label: "Avg Latency",     value: `${avgLatencyMs}ms`,            icon: <Clock size={14} />,      color: "#a78bfa" },
    { label: "P99 Latency",     value: `${p99LatencyMs}ms`,            icon: <TrendingUp size={14} />, color: "#a78bfa" },
    { label: "Uptime",          value: `${uptimePercent}%`,            icon: <Activity size={14} />,   color: "#22c55e" },
    { label: "Status",          value: monitoringStatus,               icon: <Monitor size={14} />,    color: "#22c55e" },
  ];

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Monitor size={18} className="cp-panel-icon" />
        <h2>Monitoring</h2>
        <span className="cp-badge cp-sev-low">{monitoringStatus}</span>
        <button
          className="cp-btn cp-btn-primary cp-btn-sm"
          onClick={handleOpen}
          style={{ marginLeft: "auto" }}
        >
          <ExternalLink size={13} /> OPEN GRAFANA
        </button>
      </div>

      <p className="cp-muted" style={{ fontSize: 12, marginBottom: 16 }}>
        Opens <code>http://localhost:3001</code> (Grafana). Set{" "}
        <code>GRAFANA_URL</code> in <code>controlPlaneService.js</code> to change.
      </p>

      <div className="cp-monitor-grid">
        {tiles.map((t) => (
          <div key={t.label} className="cp-monitor-tile">
            <div className="cp-monitor-icon" style={{ color: t.color }}>{t.icon}</div>
            <span className="cp-muted" style={{ fontSize: 11 }}>{t.label}</span>
            <strong style={{ color: t.color, fontSize: 17 }}>{t.value}</strong>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
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
