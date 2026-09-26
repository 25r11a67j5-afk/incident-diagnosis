import { Play, Loader2 } from 'lucide-react';

/**
 * SimulationPanel — sandbox simulation trigger and result display.
 * Props:
 *   incident    — selected incident
 *   simState    — 'idle' | 'running' | 'done' | 'failed'
 *   simResult   — { success, message, duration, checksRun, checksPassed }
 *   onSimulate  — callback
 */
export default function SimulationPanel({ incident, simState, simResult, onSimulate }) {
  if (!incident) return null;

  const isRunning = simState === 'running';
  const isDone = simState === 'done';
  const isFailed = simState === 'failed';

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Play size={18} className="cp-panel-icon" />
        <h2>Sandbox Simulation</h2>
        {isDone && <span className="cp-badge cp-sev-low">PASSED</span>}
        {isFailed && <span className="cp-badge cp-sev-critical">FAILED</span>}
      </div>

      <p className="cp-muted" style={{ marginBottom: 16 }}>
        Runs a sandboxed pre-flight check of the remediation action against a
        replica environment. No real infrastructure changes are made.
      </p>

      <button
        className={`cp-btn ${isRunning ? 'cp-btn-disabled' : isDone ? 'cp-btn-success' : 'cp-btn-primary'}`}
        onClick={onSimulate}
        disabled={isRunning}
      >
        {isRunning ? (
          <>
            <Loader2 size={16} className="cp-spin" /> Running Simulation…
          </>
        ) : isDone ? (
          <>
            <Play size={16} /> Re-run Simulation
          </>
        ) : (
          <>
            <Play size={16} /> Run Sandbox Simulation
          </>
        )}
      </button>

      {isRunning && (
        <div className="cp-sim-progress">
          <div className="cp-sim-bar" />
          <p className="cp-muted" style={{ marginTop: 8, fontSize: 12 }}>
            Simulation running in isolated replica environment…
          </p>
        </div>
      )}

      {(isDone || isFailed) && simResult && (
        <div className={`cp-sim-result ${simResult.success ? 'cp-sim-success' : 'cp-sim-fail'}`}>
          <div className="cp-sim-result-header">
            {simResult.success ? '✓ Simulation Passed' : '✗ Simulation Failed'}
          </div>
          <p className="cp-muted">{simResult.message}</p>
          <div className="cp-sim-stats">
            <div className="cp-sim-stat">
              <span>Duration</span>
              <strong>{simResult.duration}</strong>
            </div>
            <div className="cp-sim-stat">
              <span>Checks run</span>
              <strong>{simResult.checksRun}</strong>
            </div>
            <div className="cp-sim-stat">
              <span>Checks passed</span>
              <strong style={{ color: simResult.success ? '#22c55e' : '#ef4444' }}>
                {simResult.checksPassed}/{simResult.checksRun}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
