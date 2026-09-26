import { Lock, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

/**
 * ApprovalGate — human approval workflow component.
 * Props:
 *   incident      — selected incident
 *   riskResult    — { level }
 *   simDone       — boolean
 *   approvalState — 'idle' | 'approving' | 'approved'
 *   onApprove     — callback
 *   executeState  — 'idle' | 'executing' | 'done'
 *   onExecute     — callback
 */
export default function ApprovalGate({
  incident,
  riskResult,
  simDone,
  approvalState,
  onApprove,
  executeState,
  onExecute,
}) {
  if (!incident) return null;

  const { level = 'LOW' } = riskResult || {};
  const isHigh = level === 'HIGH';
  const isApproved = approvalState === 'approved';
  const isApproving = approvalState === 'approving';
  const isExecuted = executeState === 'done';
  const isExecuting = executeState === 'executing';

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Lock size={18} className="cp-panel-icon" />
        <h2>Human Approval Gate</h2>
        {isApproved ? (
          <span className="cp-badge cp-sev-low">APPROVED</span>
        ) : (
          <span className="cp-badge cp-badge-warning">AWAITING APPROVAL</span>
        )}
      </div>

      {isHigh && !isApproved && (
        <div className="cp-alert cp-alert-danger">
          <AlertTriangle size={16} />
          HIGH RISK incident — mandatory human approval required before execution.
        </div>
      )}

      <div className={`cp-approval-box ${isApproved ? 'cp-approval-approved' : ''}`}>
        <div className="cp-approval-icon">
          {isApproved ? (
            <CheckCircle2 size={36} color="#22c55e" />
          ) : (
            <Lock size={36} color={isHigh ? '#ef4444' : '#60a5fa'} />
          )}
        </div>
        <div className="cp-approval-body">
          <strong className="cp-text">
            {isApproved
              ? 'Action Approved — Ready for Execution'
              : isApproving
              ? 'Processing approval…'
              : 'Awaiting Authorized Human Approval'}
          </strong>
          <p className="cp-muted">
            {isApproved
              ? 'Approved by Operator-01. Execution is authorized.'
              : 'A qualified operator must approve before any action is executed.'}
          </p>
        </div>
      </div>

      <div className="cp-approval-actions">
        {!isApproved && (
          <button
            className={`cp-btn ${isApproving ? 'cp-btn-disabled' : 'cp-btn-primary'}`}
            onClick={onApprove}
            disabled={isApproving || !simDone}
            title={!simDone ? 'Run sandbox simulation first' : ''}
          >
            {isApproving ? (
              <>
                <Loader2 size={16} className="cp-spin" /> Processing…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Approve Action
              </>
            )}
          </button>
        )}

        {!simDone && (
          <p className="cp-muted" style={{ fontSize: 12 }}>
            ⓘ Complete sandbox simulation before approving.
          </p>
        )}

        {isApproved && !isExecuted && (
          <button
            className={`cp-btn ${isExecuting ? 'cp-btn-disabled' : 'cp-btn-success'}`}
            onClick={onExecute}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <>
                <Loader2 size={16} className="cp-spin" /> Executing…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Execute Approved Action
              </>
            )}
          </button>
        )}

        {isExecuted && (
          <div className="cp-alert cp-alert-success">
            <CheckCircle2 size={16} /> Action executed successfully. Monitor for confirmation.
          </div>
        )}
      </div>
    </div>
  );
}
