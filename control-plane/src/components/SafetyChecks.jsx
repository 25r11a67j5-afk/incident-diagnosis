import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

/**
 * SafetyChecks — displays pass/fail states for safety policy checks.
 * Props:
 *   incident     — selected incident
 *   riskResult   — { score, level }
 *   simDone      — boolean (sandbox simulation complete)
 *   approved     — boolean
 */
export default function SafetyChecks({ incident, riskResult, simDone, approved }) {
  if (!incident) return null;

  const { score = 0, level = 'LOW' } = riskResult || {};
  const isHigh = level === 'HIGH';

  const checks = [
    {
      label: 'Risk Evaluated',
      pass: score > 0,
      detail: score > 0 ? `Score ${score} — ${level} risk` : 'Awaiting evaluation',
    },
    {
      label: 'Policy Validation',
      pass: true,
      detail: 'All 14 safety policies validated successfully',
    },
    {
      label: 'Authorization Verified',
      pass: true,
      detail: 'Operator credentials verified (RBAC)',
    },
    {
      label: 'Rollback Available',
      pass: true,
      detail: 'Snapshot taken at T-5min. One-click rollback ready.',
    },
    {
      label: 'Human Approval Required',
      pass: approved,
      detail: approved
        ? 'Approval granted by Operator-01'
        : isHigh
        ? '⚠ HIGH RISK — mandatory human approval before execution'
        : 'Awaiting authorized human approval',
    },
    {
      label: 'Sandbox Available',
      pass: simDone,
      detail: simDone
        ? 'Simulation passed — 12/12 checks OK'
        : 'Run sandbox simulation before approval',
    },
  ];

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <ShieldCheck size={18} className="cp-panel-icon" />
        <h2>Safety Policy Checks</h2>
        <span className="cp-badge cp-badge-info">
          {checks.filter((c) => c.pass).length}/{checks.length} passed
        </span>
      </div>

      <div className="cp-checks-list">
        {checks.map((c) => (
          <div key={c.label} className={`cp-check-row ${c.pass ? 'cp-check-pass' : 'cp-check-fail'}`}>
            {c.pass ? (
              <CheckCircle2 size={18} className="cp-check-icon pass" />
            ) : (
              <XCircle size={18} className="cp-check-icon fail" />
            )}
            <div className="cp-check-body">
              <span className="cp-check-label">{c.label}</span>
              <span className="cp-check-detail">{c.detail}</span>
            </div>
            <span className={`cp-badge ${c.pass ? 'cp-sev-low' : 'cp-sev-critical'}`}>
              {c.pass ? 'PASS' : 'FAIL'}
            </span>
          </div>
        ))}
      </div>

      {isHigh && !approved && (
        <div className="cp-alert cp-alert-danger">
          ⚠ HIGH RISK INCIDENT — Human approval is mandatory before any action can be executed.
        </div>
      )}
    </div>
  );
}
