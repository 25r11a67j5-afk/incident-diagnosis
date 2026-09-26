import { FileText } from "lucide-react";

const ACTION_COLOR = {
  scenario_loaded:      "#60a5fa",
  risk_computed:        "#f59e0b",
  approval_requested:   "#a78bfa",
  user_approved:        "#22c55e",
  user_rejected:        "#ef4444",
  investigate_more:     "#60a5fa",
  sandbox_executed:     "#60a5fa",
  sandbox_passed:       "#22c55e",
  sandbox_failed:       "#ef4444",
  rollback_executed:    "#22c55e",
  health_verified:      "#22c55e",
  rollback_blocked:     "#ef4444",
  degraded_mode_recommended: "#f59e0b",
};

/**
 * AuditTrail — append-only audit log, newest first.
 * Props:
 *   logs — array of { id, timestamp, action, actor, details }
 */
export default function AuditTrail({ logs = [] }) {
  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <FileText size={18} className="cp-panel-icon" />
        <h2>Audit Trail</h2>
        <span className="cp-badge cp-badge-info">{logs.length} events</span>
      </div>

      {logs.length === 0 ? (
        <p className="cp-muted" style={{ padding: "12px 0", fontSize: 13 }}>
          No audit events yet. Load a scenario to begin.
        </p>
      ) : (
        <div className="cp-audit-list">
          {logs.map((log, i) => {
            const color = ACTION_COLOR[log.action] ?? "#6b7280";
            const ts = new Date(log.timestamp).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <div key={log.id ?? i} className="cp-audit-row">
                <div className="cp-audit-dot" style={{ background: color }} />
                <div className="cp-audit-body">
                  <div className="cp-audit-top">
                    <span className="cp-audit-action" style={{ color }}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    {log.actor && (
                      <span className="cp-badge cp-audit-incident">{log.actor}</span>
                    )}
                  </div>
                  <div className="cp-audit-meta">
                    <span>{ts}</span>
                    {log.details && (
                      <>
                        <span>·</span>
                        <span>{log.details}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
