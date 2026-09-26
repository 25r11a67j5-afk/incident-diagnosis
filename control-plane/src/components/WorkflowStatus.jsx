import { GitBranch, CheckCircle2, Loader2, Circle } from 'lucide-react';

const STEPS = [
  { key: 'detected', label: 'Incident Detected' },
  { key: 'risk', label: 'Risk Evaluation' },
  { key: 'safety', label: 'Safety Validation' },
  { key: 'sandbox', label: 'Sandbox Simulation' },
  { key: 'approval', label: 'Human Approval' },
  { key: 'execute', label: 'Execute Action' },
  { key: 'monitor', label: 'Monitor' },
  { key: 'rollback', label: 'Rollback if Required' },
];

/**
 * WorkflowStatus — visual step-by-step workflow tracker.
 * Props:
 *   currentStep — one of the STEPS keys
 *   rollbackDone — boolean
 */
export default function WorkflowStatus({ currentStep, rollbackDone }) {
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <GitBranch size={18} className="cp-panel-icon" />
        <h2>Execution Workflow</h2>
        <span className="cp-badge cp-badge-info">
          Step {Math.min(stepIndex + 1, STEPS.length)}/{STEPS.length}
        </span>
      </div>

      <div className="cp-workflow-steps">
        {STEPS.map((step, idx) => {
          const done = rollbackDone
            ? idx < STEPS.length - 1 && idx <= stepIndex
            : idx < stepIndex;
          const active = idx === stepIndex && !rollbackDone;
          const isLast = idx === STEPS.length - 1;
          const isRollback = step.key === 'rollback';

          let stepClass = 'cp-wf-step-pending';
          if (rollbackDone && isRollback) stepClass = 'cp-wf-step-done';
          else if (done) stepClass = 'cp-wf-step-done';
          else if (active) stepClass = 'cp-wf-step-active';

          return (
            <div key={step.key} className="cp-wf-step-wrap">
              <div className={`cp-wf-step ${stepClass}`}>
                <div className="cp-wf-icon">
                  {(done || (rollbackDone && isRollback)) ? (
                    <CheckCircle2 size={20} />
                  ) : active ? (
                    <Loader2 size={20} className={active ? 'cp-spin' : ''} />
                  ) : (
                    <Circle size={20} />
                  )}
                </div>
                <span className="cp-wf-label">{step.label}</span>
                {active && (
                  <span className="cp-badge cp-badge-warning" style={{ marginLeft: 'auto' }}>
                    CURRENT
                  </span>
                )}
                {(done || (rollbackDone && isRollback)) && (
                  <span className="cp-badge cp-sev-low" style={{ marginLeft: 'auto' }}>
                    DONE
                  </span>
                )}
                {isRollback && !rollbackDone && (
                  <span className="cp-muted" style={{ marginLeft: 'auto', fontSize: 11 }}>
                    safety net
                  </span>
                )}
              </div>
              {!isLast && <div className="cp-wf-connector" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
