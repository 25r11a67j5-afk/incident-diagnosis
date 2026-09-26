import { Clock, Zap, Database, Server, Terminal } from "lucide-react";

const SOURCE_ICON = {
  Prometheus:           <Zap size={13} />,
  Elasticsearch:        <Database size={13} />,
  deployment_metadata:  <Terminal size={13} />,
};

const SOURCE_COLOR = {
  Prometheus:           "#f59e0b",
  Elasticsearch:        "#60a5fa",
  deployment_metadata:  "#a78bfa",
};

const TYPE_BADGE = {
  deployment:      { label: "DEPLOY",   color: "#a78bfa", bg: "rgba(139,92,246,0.15)" },
  schema_migration:{ label: "MIGRATION",color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  metric_anomaly:  { label: "METRIC",   color: "#f87171", bg: "rgba(239,68,68,0.15)"  },
  log_pattern:     { label: "LOG",      color: "#60a5fa", bg: "rgba(59,130,246,0.15)" },
};

const SEVERITY_DOT = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#fbbf24",
  info:     "#6b7280",
};

/**
 * Timeline — PRD chronological incident timeline.
 * Props:
 *   events — array from scenario.timeline
 */
export default function Timeline({ events = [] }) {
  if (!events.length) {
    return (
      <div className="cp-panel">
        <div className="cp-panel-header">
          <Clock size={18} className="cp-panel-icon" />
          <h2>Incident Timeline</h2>
        </div>
        <p className="cp-muted" style={{ padding: "12px 0" }}>No timeline data loaded. Run diagnosis to populate.</p>
      </div>
    );
  }

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Clock size={18} className="cp-panel-icon" />
        <h2>Incident Timeline</h2>
        <span className="cp-badge cp-badge-info">{events.length} events</span>
      </div>

      <div className="tl-list">
        {events.map((ev, i) => {
          const typeMeta = TYPE_BADGE[ev.event_type] ?? { label: ev.event_type.toUpperCase(), color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
          const srcColor = SOURCE_COLOR[ev.source] ?? "#6b7280";
          const dotColor = SEVERITY_DOT[ev.severity] ?? "#6b7280";
          const ts = new Date(ev.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

          return (
            <div key={i} className="tl-row">
              {/* Spine */}
              <div className="tl-spine">
                <div className="tl-dot" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}88` }} />
                {i < events.length - 1 && <div className="tl-line" />}
              </div>

              {/* Content */}
              <div className="tl-content">
                <div className="tl-top">
                  <span className="tl-time">{ts}</span>
                  <span
                    className="cp-badge"
                    style={{ color: typeMeta.color, background: typeMeta.bg }}
                  >
                    {typeMeta.label}
                  </span>
                  <span className="tl-service">
                    <Server size={11} /> {ev.service}
                  </span>
                </div>
                <p className="tl-summary">{ev.summary}</p>
                <div className="tl-source" style={{ color: srcColor }}>
                  {SOURCE_ICON[ev.source] ?? <Database size={13} />}
                  <span>{ev.source}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
