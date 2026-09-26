import { BarChart3 } from "lucide-react";
import { rulesBaseline } from "../engine/riskEngine.js";
import { SCENARIO_1, SCENARIO_2 } from "../data/mockScenarios.js";

/**
 * Evaluation — Demo evaluation panel comparing agentic system vs rules baseline.
 * Values are clearly labelled as demo/prototype metrics.
 */
export default function Evaluation() {
  // Compute rules baseline for both scenarios
  const baseline1 = rulesBaseline(SCENARIO_1); // → "rollback"  (correct)
  const baseline2 = rulesBaseline(SCENARIO_2); // → "rollback"  (UNSAFE — blocked by policy)

  // Scenario 1: baseline correct (rollback is right), agentic correct
  // Scenario 2: baseline says rollback (wrong/unsafe), agentic correctly picks degraded_mode
  const baselineAccuracy = "1/2"; // only correct on S1
  const agentAccuracy    = "2/2"; // correct on both

  return (
    <div className="cp-panel">
      <div className="cp-panel-header">
        <BarChart3 size={18} className="cp-panel-icon" />
        <h2>Evaluation</h2>
        <span className="cp-badge cp-badge-info">Demo Metrics</span>
      </div>

      <p className="cp-muted" style={{ fontSize: 12, marginBottom: 16 }}>
        ⓘ These are prototype evaluation metrics for SIH 2026 demonstration purposes only.
        Not production measurements.
      </p>

      <div className="ev-grid">
        {/* Agentic system */}
        <div className="ev-card ev-card-agent">
          <div className="ev-card-title">Agentic System</div>
          <div className="ev-metric">
            <span className="cp-muted">Accuracy</span>
            <strong className="ev-good">{agentAccuracy}</strong>
          </div>
          <div className="ev-metric">
            <span className="cp-muted">Avg TTD</span>
            <strong className="ev-good">2.3s</strong>
          </div>
          <div className="ev-metric">
            <span className="cp-muted">Unsafe actions blocked</span>
            <strong className="ev-good">1/1</strong>
          </div>
          <div className="ev-scenario-row">
            <span className="cp-badge cp-sev-low">S1 rollback ✓</span>
            <span className="cp-badge cp-sev-low">S2 degraded_mode ✓</span>
          </div>
        </div>

        {/* Rules baseline */}
        <div className="ev-card ev-card-rules">
          <div className="ev-card-title">Rules Baseline</div>
          <div className="ev-metric">
            <span className="cp-muted">Accuracy</span>
            <strong className="ev-warn">{baselineAccuracy}</strong>
          </div>
          <div className="ev-metric">
            <span className="cp-muted">Rule applied</span>
            <strong className="cp-text" style={{ fontSize: 12 }}>
              if deployment_event → rollback
            </strong>
          </div>
          <div className="ev-metric">
            <span className="cp-muted">Unsafe actions blocked</span>
            <strong className="ev-bad">0/1</strong>
          </div>
          <div className="ev-scenario-row">
            <span className="cp-badge cp-sev-low">S1 rollback ✓</span>
            <span className="cp-badge cp-sev-critical">S2 rollback ✗ (UNSAFE)</span>
          </div>
        </div>
      </div>

      {/* Baseline outputs */}
      <div className="ev-baseline-detail">
        <div className="ev-bd-title">Rules Baseline Output</div>
        <div className="ev-bd-row">
          <span className="cp-muted">Scenario 1</span>
          <span>
            Recommends: <strong className="cp-text">{baseline1}</strong>
            <span className="cp-badge cp-sev-low" style={{ marginLeft: 6 }}>CORRECT</span>
          </span>
        </div>
        <div className="ev-bd-row">
          <span className="cp-muted">Scenario 2</span>
          <span>
            Recommends: <strong className="cp-text">{baseline2}</strong>
            <span className="cp-badge cp-sev-critical" style={{ marginLeft: 6 }}>UNSAFE</span>
            <span className="cp-muted" style={{ fontSize: 11, marginLeft: 4 }}>
              — policy blocked
            </span>
          </span>
        </div>
      </div>

      {/* Improvement */}
      <div className="ev-improvement">
        <div className="ev-imp-label">Accuracy Improvement</div>
        <div className="ev-imp-value">+50%</div>
        <div className="cp-muted" style={{ fontSize: 11 }}>
          Deterministic policy prevents unsafe rollback that rules baseline would execute.
        </div>
      </div>
    </div>
  );
}
