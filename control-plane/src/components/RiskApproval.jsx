import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Loader2, MoreHorizontal } from "lucide-react";

/**
 * RiskApproval — Combined Risk Score + Policy Check + Approval Controls
 * Props:
 *   scenario       — full scenario object
 *   riskResult     — { score, level, breakdown }
 *   approvalState  — 'idle' | 'approving' | 'approved' | 'rejected' | 'investigating'
 *   onApprove      — callback
 *   onReject       — callback
 *   onInvestigate  — callback
 */
export default function RiskApproval({
  scenario,
  riskResult,
  approvalState,
  onApprove,
  onReject,
  onInvestigate,
}) {
  if (!scenario) {
    return (
      <div className="cp-panel">
        <div className="cp-panel-header">
          <ShieldCheck size={18} className="cp-panel-icon" />
          <h2>Risk &amp; Approval</h2>
        </div>
        <p className="cp-muted" style={{ padding: "12px 0" }}>Select a scenario and run diagnosis.</p>
      </div>
    );
  }

  const policy = scenario.policy;
  const rec = scenario.recommended_action;
  const { score = 0, level = "LOW", breakdown = {} } = riskResult || {};

  const rollbackUnsafe = !policy.rollback_safe;
  const canApprove = policy.rollback_eligible || rec.action_type !== "rollback";
  // For rollback-unsafe scenarios, disable approve
  const approveDisabled =
    approvalState === "approving" ||
    approvalState === "approved" ||
    (rec.action_type === "rollback" && rollbackUnsafe);

  const levelColor =
    level === "HIGH" ? "#ef4444" : level === "MEDIUM" ? "#f59e0b" : "#22c55e";

  const scorePercent = Math.round(score * 100);

  const policyChecks = [
    {
      label: "Is Rollback Action",
      pass: policy.is_rollback,
      value: policy.is_rollback ? "Yes" : "No",
    },
    {
      label: "Known-Good Version Available",
      pass: policy.has_known_good_version,
      value: policy.has_known_good_version ? rec.target_version ?? "Yes" : "None",
    },
    {
      label: "Rollback Safe",
      pass: policy.rollback_safe,
      value: policy.rollback_safe ? "TRUE" : "FALSE ⚠️",
    },
    {
      label: "Temporal Correlation",
      pass: policy.temporal_correlation,
      value: policy.temporal_correlation ? "Confirmed" : "Not detected",
    },
    {
      label: "Rollback Eligible",
      pass: policy.rollback_eligible,
      value: policy.rollback_eligible ? "YES" : "NO",
    },
  ];

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <ShieldCheck size={18} className="cp-panel-icon" />
        <h2>Risk &amp; Approval</h2>
        <span
          className="cp-badge"
          style={{
            color: levelColor,
            background: `${levelColor}22`,
          }}
        >
          {level} RISK
        </span>
      </div>

      {/* ── Risk score row ── */}
      <div className="ra-score-row">
        <div className="ra-score-big" style={{ color: levelColor }}>
          {score.toFixed(3)}
        </div>
        <div className="ra-score-detail">
          <p className="cp-muted" style={{ fontSize: 12 }}>
            Action: <strong className="cp-text">{rec.action_type}</strong>
          </p>
          <p className="cp-muted" style={{ fontSize: 12 }}>
            Service: <strong className="cp-text">{rec.target_service}</strong>
          </p>
          {rec.target_version && (
            <p className="cp-muted" style={{ fontSize: 12 }}>
              Version: <strong className="cp-text">{rec.target_version}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="cp-bar-track" style={{ marginBottom: 8 }}>
        <div
          className="cp-bar-fill"
          style={{ width: `${Math.min(scorePercent * 1.5, 100)}%`, background: levelColor }}
        />
      </div>

      {/* Breakdown */}
      <div className="ra-breakdown">
        <span className="cp-muted" style={{ fontSize: 11 }}>
          impact {breakdown.impact} + (1 − reversibility {breakdown.adjustedReversibility}) + blast_radius {breakdown.blast_radius} / 3
        </span>
      </div>

      {/* Rationale */}
      <div className="ra-rationale">
        <p className="cp-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
          <strong className="cp-text">Rationale: </strong>{rec.rationale}
        </p>
      </div>

      {/* ── Rollback unsafe warning ── */}
      {rollbackUnsafe && (
        <div className="ra-unsafe-banner">
          <AlertTriangle size={20} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="ra-unsafe-title" style={{ color: "#ef4444", fontWeight: 700, fontSize: 13 }}>
              ⚠️ ROLLBACK BLOCKED — DATABASE SCHEMA MIGRATION DETECTED
            </div>
            <div className="ra-unsafe-reason" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
              {policy.unsafe_reason}
            </div>
            {rec.action_type !== "rollback" && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#86efac" }}>
                ✓ Safe Alternative Recommended: <strong>{rec.action_type.replace("_", " ").toUpperCase()}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Policy checks ── */}
      <div className="ra-policy-title">Policy Checks</div>
      <div className="cp-checks-list" style={{ marginBottom: 16 }}>
        {policyChecks.map((c) => (
          <div key={c.label} className={`cp-check-row ${c.pass ? "cp-check-pass" : "cp-check-fail"}`}>
            {c.pass ? (
              <CheckCircle2 size={16} className="cp-check-icon pass" />
            ) : (
              <XCircle size={16} className="cp-check-icon fail" />
            )}
            <div className="cp-check-body">
              <span className="cp-check-label">{c.label}</span>
              <span className="cp-check-detail">{c.value}</span>
            </div>
            <span className={`cp-badge ${c.pass ? "cp-sev-low" : "cp-sev-critical"}`}>
              {c.pass ? "PASS" : "FAIL"}
            </span>
          </div>
        ))}
      </div>

      {/* ── Approval state display ── */}
      {approvalState === "approved" && (
        <div className="cp-alert cp-alert-success">
          <CheckCircle2 size={16} /> Action approved by Operator-01
        </div>
      )}
      {approvalState === "rejected" && (
        <div className="cp-alert cp-alert-danger">
          <XCircle size={16} /> Action rejected by Operator-01
        </div>
      )}
      {approvalState === "investigating" && (
        <div className="cp-alert" style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>
          <MoreHorizontal size={16} /> Investigation queued — awaiting further analysis
        </div>
      )}

      {/* ── Approval controls ── */}
      {approvalState === "idle" || approvalState === "approving" ? (
        <div className="ra-actions">
          <button
            className={`cp-btn ${approveDisabled ? "cp-btn-disabled" : "cp-btn-success"}`}
            onClick={onApprove}
            disabled={approveDisabled}
            title={rollbackUnsafe && rec.action_type === "rollback" ? "Rollback disabled — rollback_safe=false" : ""}
          >
            {approvalState === "approving" ? (
              <><Loader2 size={15} className="cp-spin" /> Approving…</>
            ) : (
              <><CheckCircle2 size={15} /> APPROVE</>
            )}
          </button>

          <button
            className="cp-btn cp-btn-danger"
            onClick={onReject}
            disabled={approvalState === "approving"}
          >
            <XCircle size={15} /> REJECT
          </button>

          <button
            className="cp-btn cp-btn-outline"
            onClick={onInvestigate}
            disabled={approvalState === "approving"}
          >
            <MoreHorizontal size={15} /> INVESTIGATE MORE
          </button>
        </div>
      ) : (
        approvalState !== "approving" && (
          <p className="cp-muted" style={{ fontSize: 12, marginTop: 12 }}>
            Approval decision recorded. Reset demo to re-evaluate.
          </p>
        )
      )}
    </div>
  );
}
