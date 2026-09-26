import { Play, Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * Sandbox — Simulation panel showing health before/after.
 * Props:
 *   scenario     — full scenario object
 *   simState     — 'idle' | 'running' | 'pass' | 'fail'
 *   simResult    — sandbox_result object
 *   approved     — boolean (approval required before sandbox)
 *   onRun        — callback
 */
export default function Sandbox({ scenario, simState, simResult, approved, onRun }) {
  if (!scenario) {
    return (
      <div className="cp-panel">
        <div className="cp-panel-header">
          <Play size={18} className="cp-panel-icon" />
          <h2>Sandbox Simulation</h2>
        </div>
        <p className="cp-muted" style={{ padding: "12px 0" }}>Load a scenario first.</p>
      </div>
    );
  }

  const isRunning = simState === "running";
  const isPassed  = simState === "pass";
  const isFailed  = simState === "fail";
  const isDone    = isPassed || isFailed;

  // Use scenario's expected sandbox result as preview
  const preview = scenario.sandbox_result;

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <Play size={18} className="cp-panel-icon" />
        <h2>Sandbox Simulation</h2>
        {isPassed && <span className="cp-badge cp-sev-low">PASS — HEALTH RECOVERED</span>}
        {isFailed && <span className="cp-badge cp-sev-critical">FAIL</span>}
      </div>

      <p className="cp-muted" style={{ marginBottom: 16, fontSize: 13 }}>
        Simulates the recommended action in an isolated replica.
        No real infrastructure changes are performed.
      </p>

      {/* Health before (always shown) */}
      <div className="sb-health-row">
        <div className="sb-health-card">
          <span className="cp-muted sb-label">Health Before</span>
          <div className="sb-metric">
            <span className="cp-muted">Error Rate</span>
            <strong className="sb-bad">{preview.health_before.error_rate}%</strong>
          </div>
          <div className="sb-metric">
            <span className="cp-muted">P99 Latency</span>
            <strong className="sb-bad">{preview.health_before.p99_latency_ms}ms</strong>
          </div>
        </div>

        <div className="sb-arrow">→</div>

        <div className={`sb-health-card ${isDone ? (isPassed ? "sb-card-pass" : "sb-card-fail") : "sb-card-pending"}`}>
          <span className="cp-muted sb-label">Health After</span>
          {isDone ? (
            <>
              <div className="sb-metric">
                <span className="cp-muted">Error Rate</span>
                <strong className={isPassed ? "sb-good" : "sb-bad"}>
                  {(simResult ?? preview).health_after.error_rate}%
                </strong>
              </div>
              <div className="sb-metric">
                <span className="cp-muted">P99 Latency</span>
                <strong className={isPassed ? "sb-good" : "sb-bad"}>
                  {(simResult ?? preview).health_after.p99_latency_ms}ms
                </strong>
              </div>
            </>
          ) : (
            <p className="cp-muted" style={{ fontSize: 12 }}>Run simulation to see projected recovery</p>
          )}
        </div>
      </div>

      {/* Run button */}
      <button
        className={`cp-btn ${isRunning ? "cp-btn-disabled" : isPassed ? "cp-btn-success" : "cp-btn-primary"} cp-btn-block`}
        onClick={onRun}
        disabled={isRunning || !approved}
        title={!approved ? "Approve action first" : ""}
        style={{ marginTop: 16 }}
      >
        {isRunning ? (
          <><Loader2 size={15} className="cp-spin" /> Simulation running…</>
        ) : isPassed ? (
          <><Play size={15} /> Re-run Simulation</>
        ) : (
          <><Play size={15} /> Run Sandbox Simulation</>
        )}
      </button>

      {!approved && (
        <p className="cp-muted" style={{ fontSize: 12, marginTop: 6 }}>
          ⓘ Approve the action before running sandbox simulation.
        </p>
      )}

      {/* Progress bar while running */}
      {isRunning && (
        <div style={{ marginTop: 12 }}>
          <div className="cp-sim-bar" />
          <p className="cp-muted" style={{ fontSize: 12, marginTop: 6 }}>
            Applying action in isolated replica environment…
          </p>
        </div>
      )}

      {/* Result */}
      {isDone && simResult && (
        <div className={`sb-result ${isPassed ? "sb-result-pass" : "sb-result-fail"}`}>
          {isPassed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <div>
            <strong>{isPassed ? "✓ Simulation PASSED" : "✗ Simulation FAILED"}</strong>
            <p className="cp-muted" style={{ fontSize: 12, marginTop: 4 }}>{simResult.message}</p>
            <p className="cp-muted" style={{ fontSize: 11, marginTop: 4 }}>
              Checks: {simResult.checks_passed}/{simResult.checks_run} passed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
