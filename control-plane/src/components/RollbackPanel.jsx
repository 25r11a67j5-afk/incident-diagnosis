import { RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * RollbackPanel — rollback mechanism with state feedback.
 * Props:
 *   incident       — selected incident
 *   rollbackState  — 'idle' | 'rolling' | 'done'
 *   onRollback     — callback
 *   executeState   — 'idle' | 'executing' | 'done'
 */
export default function RollbackPanel({ incident, rollbackState, onRollback, executeState }) {
  if (!incident) return null;

  const isRolling = rollbackState === 'rolling';
  const isDone = rollbackState === 'done';
  const canRollback = executeState === 'done' || rollbackState !== 'idle';

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <RotateCcw size={18} className="cp-panel-icon" />
        <h2>Rollback Mechanism</h2>
        {isDone && <span className="cp-badge cp-sev-low">COMPLETED</span>}
      </div>

      <p className="cp-muted" style={{ marginBottom: 16 }}>
        Rollback restores the system to the last known stable snapshot. This is
        a safety mechanism — no data is lost. Available immediately after action
        execution.
      </p>

      <div className="cp-rollback-info">
        <div className="cp-rollback-detail">
          <span className="cp-muted">Snapshot</span>
          <strong className="cp-text">T-5min checkpoint</strong>
        </div>
        <div className="cp-rollback-detail">
          <span className="cp-muted">Est. rollback time</span>
          <strong className="cp-text">~30 seconds</strong>
        </div>
        <div className="cp-rollback-detail">
          <span className="cp-muted">Data safety</span>
          <strong className="cp-text" style={{ color: '#22c55e' }}>Guaranteed</strong>
        </div>
      </div>

      {isDone ? (
        <div className="cp-alert cp-alert-success">
          <CheckCircle2 size={16} />
          Rollback completed. System restored to last stable state for {incident.id}.
        </div>
      ) : (
        <button
          className={`cp-btn ${isRolling ? 'cp-btn-disabled' : 'cp-btn-danger'}`}
          onClick={onRollback}
          disabled={isRolling || !canRollback}
          title={!canRollback ? 'Execute action first to enable rollback' : ''}
        >
          {isRolling ? (
            <>
              <Loader2 size={16} className="cp-spin" /> Rolling back…
            </>
          ) : (
            <>
              <RotateCcw size={16} /> Initiate Rollback
            </>
          )}
        </button>
      )}

      {!canRollback && (
        <p className="cp-muted" style={{ fontSize: 12, marginTop: 8 }}>
          ⓘ Execute an approved action first to enable rollback.
        </p>
      )}
    </div>
  );
}
