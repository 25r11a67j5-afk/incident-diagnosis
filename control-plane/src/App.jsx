import { useState, useEffect, useCallback } from "react";
import "./App.css";

// Engine
import { computeRisk } from "./engine/riskEngine.js";

// Services
import {
  diagnoseIncident,
  checkBackendAvailability,
  isBackendAvailable,
  runSandbox,
  approveAction as svcApprove,
  rejectAction as svcReject,
  rollbackAction as svcRollback,
  BACKEND_URL,
  GRAFANA_URL,
} from "./services/controlPlaneService.js";

// Components
import Timeline     from "./components/Timeline.jsx";
import Hypotheses   from "./components/Hypotheses.jsx";
import RiskApproval from "./components/RiskApproval.jsx";
import Sandbox      from "./components/Sandbox.jsx";
import AuditTrail   from "./components/AuditTrail.jsx";
import Evaluation   from "./components/Evaluation.jsx";
import Monitoring   from "./components/Monitoring.jsx";

// Icons
import {
  Shield,
  Activity,
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
  Database,
  RotateCcw,
  Loader2,
  Server,
  Zap,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _logId = 0;
function makeLog(action, actor, details = "") {
  return {
    id: `L-${++_logId}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    details,
  };
}

function makeInitialWorkState() {
  return {
    diagnosisLoading: false,
    approvalState: "idle",  // idle | approving | approved | rejected | investigating
    simState: "idle",       // idle | running | pass | fail
    simResult: null,
    rollbackDone: false,
  };
}

// ---------------------------------------------------------------------------
// App Component
// ---------------------------------------------------------------------------

export default function App() {
  // ── Scenario selector (INC-001 vs INC-002)
  const [scenarioId, setScenarioId] = useState("INC-001");
  const [forceLive, setForceLive]   = useState(false);

  // ── State
  const [scenario, setScenario]         = useState(null);
  const [riskResult, setRiskResult]     = useState(null);
  const [workState, setWorkState]       = useState(makeInitialWorkState());
  const [auditLogs, setAuditLogs]       = useState([]);
  const [backendOk, setBackendOk]       = useState(null); // null=checking, true, false
  const [error, setError]               = useState(null);

  // ── Check backend on mount and poll
  const verifyBackend = useCallback(async () => {
    await checkBackendAvailability();
    setBackendOk(isBackendAvailable());
  }, []);

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 10000);
    return () => clearInterval(interval);
  }, [verifyBackend]);

  // ── Audit log helper
  const addLog = useCallback((action, actor, details = "") => {
    setAuditLogs((prev) => [makeLog(action, actor, details), ...prev]);
  }, []);

  // ---------------------------------------------------------------------------
  // Run Diagnosis (POST http://localhost:5002/diagnose)
  // ---------------------------------------------------------------------------
  const handleRunDiagnosis = useCallback(async (overrideForceLive = null) => {
    const isLive = overrideForceLive !== null ? overrideForceLive : forceLive;
    setError(null);
    setWorkState(makeInitialWorkState());
    setScenario(null);
    setRiskResult(null);
    setAuditLogs([]);

    setWorkState((s) => ({ ...s, diagnosisLoading: true }));
    addLog("diagnosis_dispatched", "Control Plane",
      `Calling POST ${BACKEND_URL}/diagnose for scenario=${scenarioId} (force_live=${isLive})`
    );

    try {
      const { data, source } = await diagnoseIncident(scenarioId, isLive);
      if (!data) throw new Error("No diagnosis data returned from backend");

      setScenario(data);

      // Compute risk deterministically
      const rec = data.recommended_action;
      const risk = computeRisk(rec.action_type, rec.rollback_safe);
      setRiskResult(risk);

      // Audit events
      addLog("scenario_loaded", "System", `Incident ${data.incident.incident_id}: ${data.incident.description}`);
      addLog("diagnosis_completed", "Reasoning Engine",
        `RCA complete in ${data.diagnosis_time_ms}ms · source: ${source} · action: ${rec.action_type}`
      );
      addLog("risk_computed", "Risk Engine",
        `action=${rec.action_type} score=${risk.score} level=${risk.level} rollback_safe=${rec.rollback_safe}`
      );

      // If rollback unsafe, audit the deterministic safety override
      if (!rec.rollback_safe) {
        addLog("rollback_blocked", "Policy Engine",
          `⚠️ Deterministic Safety Override: ${data.policy.unsafe_reason}`
        );
        addLog("degraded_mode_recommended", "Policy Engine",
          "Alternative recommendation: Operate in degraded mode while deploying backward-compatible schema fix"
        );
      }
    } catch (err) {
      console.error("Diagnosis error:", err);
      setError({
        status: err.status || 500,
        message: err.message || "Failed to reach reasoning engine",
        detail: err.detail,
        hint: err.hint,
      });
      addLog("diagnosis_failed", "System", `Error ${err.status || 500}: ${err.message}`);
    } finally {
      setWorkState((s) => ({ ...s, diagnosisLoading: false }));
    }
  }, [scenarioId, forceLive, addLog]);

  // ---------------------------------------------------------------------------
  // Approval Actions
  // ---------------------------------------------------------------------------
  const handleApprove = useCallback(async () => {
    if (!scenario) return;
    setWorkState((s) => ({ ...s, approvalState: "approving" }));
    addLog("approval_requested", "Operator-01",
      `Requesting approval for ${scenario.recommended_action.action_type} on ${scenario.incident.service}`
    );

    await svcApprove(scenario.scenario_id, scenario.incident.incident_id, scenario.recommended_action.action_type);
    setWorkState((s) => ({ ...s, approvalState: "approved" }));
    addLog("user_approved", "Operator-01",
      `Approved ${scenario.recommended_action.action_type} for ${scenario.incident.incident_id}`
    );
  }, [scenario, addLog]);

  const handleReject = useCallback(async () => {
    if (!scenario) return;
    await svcReject(scenario.scenario_id, scenario.incident.incident_id);
    setWorkState((s) => ({ ...s, approvalState: "rejected" }));
    addLog("user_rejected", "Operator-01", `Rejected action for ${scenario.incident.incident_id}`);
  }, [scenario, addLog]);

  const handleInvestigate = useCallback(() => {
    if (!scenario) return;
    setWorkState((s) => ({ ...s, approvalState: "investigating" }));
    addLog("investigate_more", "Operator-01", `Queued deep investigation for ${scenario.incident.incident_id}`);
  }, [scenario, addLog]);

  // ---------------------------------------------------------------------------
  // Sandbox Simulation
  // ---------------------------------------------------------------------------
  const handleRunSandbox = useCallback(async () => {
    if (!scenario) return;
    setWorkState((s) => ({ ...s, simState: "running", simResult: null }));
    addLog("sandbox_executed", "Sandbox Engine",
      `Simulating ${scenario.recommended_action.action_type} for ${scenario.incident.incident_id}`
    );

    try {
      const result = await runSandbox(scenario.scenario_id, scenario.recommended_action.action_type);
      const passed = result.status === "pass";
      setWorkState((s) => ({ ...s, simState: passed ? "pass" : "fail", simResult: result }));
      addLog(passed ? "sandbox_passed" : "sandbox_failed", "Sandbox Engine", result.message);

      if (passed) {
        addLog("health_verified", "Monitor Agent",
          `Projected health restored: error rate ${result.health_after.error_rate}% · P99 ${result.health_after.p99_latency_ms}ms`
        );
      }
    } catch (err) {
      console.error("Sandbox error:", err);
      setWorkState((s) => ({ ...s, simState: "fail" }));
    }
  }, [scenario, addLog]);

  // ---------------------------------------------------------------------------
  // Rollback Execution
  // ---------------------------------------------------------------------------
  const handleRollback = useCallback(async () => {
    if (!scenario) return;
    addLog("rollback_executed", "Control Plane",
      `Rolling back ${scenario.incident.service} to ${scenario.recommended_action.target_version}`
    );
    await svcRollback(
      scenario.scenario_id,
      scenario.incident.incident_id,
      scenario.recommended_action.target_version
    );
    setWorkState((s) => ({ ...s, rollbackDone: true }));
    addLog("health_verified", "Monitor Agent", "Service health restored to verified baseline");
  }, [scenario, addLog]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const handleReset = useCallback(() => {
    setScenario(null);
    setRiskResult(null);
    setError(null);
    setWorkState(makeInitialWorkState());
    setAuditLogs([]);
  }, []);

  const isLoading = workState.diagnosisLoading;
  const approved  = workState.approvalState === "approved";

  return (
    <div className="cp-app">
      {/* ══ TOP BAR ══ */}
      <header className="cp-header">
        <div className="cp-header-left">
          <div className="cp-header-logo">
            <Shield size={26} className="cp-logo-icon" />
            <div>
              <h1 className="cp-header-title">Incident Diagnosis &amp; Control Plane</h1>
              <p className="cp-header-sub">Automated Root Cause Analysis &amp; Safe Remediation Platform</p>
            </div>
          </div>
        </div>

        <div className="cp-header-right">
          {/* Backend Status indicator */}
          <div
            className={`cp-status-badge ${backendOk ? "online" : "offline"}`}
            title={`Backend URL: ${BACKEND_URL}`}
          >
            {backendOk ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="cp-status-dot" />
            {backendOk === null ? "CHECKING BACKEND…" : backendOk ? "BACKEND CONNECTED (5002)" : "BACKEND OFFLINE"}
          </div>

          {/* Scenario Selector */}
          <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.04)", padding: "3px 6px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              className={`cp-btn cp-btn-sm ${scenarioId === "INC-001" ? "cp-btn-primary" : "cp-btn-ghost"}`}
              onClick={() => { setScenarioId("INC-001"); handleReset(); }}
              title="Scenario 1: Payment regression, safe rollback"
            >
              INC-001 (Payment)
            </button>
            <button
              className={`cp-btn cp-btn-sm ${scenarioId === "INC-002" ? "cp-btn-primary" : "cp-btn-ghost"}`}
              onClick={() => { setScenarioId("INC-002"); handleReset(); }}
              title="Scenario 2: DB schema migration, rollback blocked"
            >
              INC-002 (DB Schema)
            </button>
          </div>

          {/* Force Live toggle */}
          <label className="cp-toggle-label" title="force_live: true forces live queries to simulation API (503 if offline). force_live: false uses resilient local fallback.">
            <input
              type="checkbox"
              checked={forceLive}
              onChange={(e) => setForceLive(e.target.checked)}
              className="cp-toggle-input"
            />
            <span className="cp-toggle-text">Force Live API</span>
          </label>

          {/* Diagnose Button */}
          <button
            className="cp-btn cp-btn-success cp-btn-sm"
            onClick={() => handleRunDiagnosis()}
            disabled={isLoading}
          >
            {isLoading ? (
              <><Loader2 size={14} className="cp-spin" /> Diagnosing…</>
            ) : (
              <><Activity size={14} /> Diagnose {scenarioId}</>
            )}
          </button>

          {/* Reset */}
          <button className="cp-btn cp-btn-ghost cp-btn-sm" onClick={handleReset}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </header>

      <main className="cp-main">
        {/* ── Error Banner (Structured backend 503 or network failure) ── */}
        {error && (
          <div className="cp-panel" style={{ border: "1px solid #ef4444", background: "rgba(239, 68, 68, 0.08)", marginBottom: 18 }}>
            <div className="cp-panel-header">
              <AlertTriangle size={20} style={{ color: "#ef4444" }} />
              <h2 style={{ color: "#f87171" }}>Diagnosis Pipeline Notice — HTTP {error.status}</h2>
              <span className="cp-badge cp-sev-critical">{error.detail?.error || "SERVICE_ERROR"}</span>
            </div>
            <p style={{ color: "#fca5a5", fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
              {error.message}
            </p>
            {error.hint && (
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: 6, fontSize: 12, color: "#93c5fd", marginBottom: 12, borderLeft: "3px solid #3b82f6" }}>
                💡 <strong>Integration Hint:</strong> {error.hint}
              </div>
            )}
            {error.status === 503 && (
              <button
                className="cp-btn cp-btn-primary cp-btn-sm"
                onClick={() => {
                  setForceLive(false);
                  handleRunDiagnosis(false);
                }}
              >
                <RefreshCw size={13} /> Retry with Resilient Fallback Mode (force_live: false)
              </button>
            )}
          </div>
        )}

        {/* ── Incident Investigation Dashboard Overview (Items 1, 2, 3, 11, 12) ── */}
        {scenario && (
          <div className="cp-panel" style={{ marginBottom: 16, borderLeft: "4px solid #3b82f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span className="cp-badge cp-sev-critical" style={{ fontSize: 12, fontWeight: 700 }}>
                    {scenario.incident.severity}
                  </span>
                  <span className="cp-badge cp-badge-info" style={{ fontSize: 12 }}>
                    STATUS: {scenario.incident.status}
                  </span>
                  <h2 style={{ fontSize: 18, color: "#f3f4f6", margin: 0 }}>
                    {scenario.incident.incident_id} — {scenario.scenario_name}
                  </h2>
                </div>
                <p className="cp-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {scenario.incident.description}
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="cp-muted" style={{ fontSize: 10 }}>DIAGNOSIS TIME</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#38bdf8" }}>{scenario.diagnosis_time_ms} ms</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="cp-muted" style={{ fontSize: 10 }}>RCA SOURCE</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>{scenario.diagnosis_source}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Affected Services */}
              <div>
                <div className="cp-muted" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Affected Services
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(scenario.incident.affected_services || [scenario.incident.service]).map((svc, idx) => (
                    <span
                      key={svc}
                      className="cp-badge"
                      style={{
                        background: idx === 0 ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                        color: idx === 0 ? "#f87171" : "#9ca3af",
                        border: idx === 0 ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <Server size={11} style={{ marginRight: 4 }} /> {svc} {idx === 0 ? "(root)" : ""}
                    </span>
                  ))}
                </div>
              </div>

              {/* Customer Impact */}
              <div>
                <div className="cp-muted" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Customer Impact
                </div>
                <div style={{ fontSize: 13, color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertOctagon size={14} />
                  <span>{scenario.incident.customer_impact}</span>
                </div>
              </div>

              {/* Data Sources Queried */}
              <div>
                <div className="cp-muted" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Data Sources Queried
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(scenario.data_sources_queried || []).map((src) => (
                    <span
                      key={src}
                      className="cp-badge"
                      style={{ background: "rgba(59,130,246,0.1)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.2)" }}
                    >
                      <Database size={11} style={{ marginRight: 4 }} /> {src.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!scenario && !isLoading && !error && (
          <div className="cp-empty">
            <Database size={44} className="cp-muted" style={{ marginBottom: 12 }} />
            <p className="cp-text" style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>
              Select an Incident &amp; Start Diagnosis
            </p>
            <p className="cp-muted" style={{ fontSize: 13, maxWidth: 500, margin: "0 auto 16px" }}>
              Demonstrate automated root cause analysis with <strong>INC-001</strong> (Payment Regression → Rollback) and <strong>INC-002</strong> (Schema Migration → Rollback Blocked by Deterministic Safety Override).
            </p>
            <button
              className="cp-btn cp-btn-primary"
              onClick={() => handleRunDiagnosis()}
            >
              <Activity size={15} /> Diagnose {scenarioId}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="cp-empty">
            <Loader2 size={40} className="cp-spin cp-logo-icon" style={{ marginBottom: 12 }} />
            <p className="cp-text" style={{ fontSize: 15, fontWeight: 500 }}>
              Investigating {scenarioId} via Reasoning Engine…
            </p>
            <p className="cp-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Correlating Elasticsearch logs &amp; traces, Prometheus metrics, and evaluating deterministic safety overrides.
            </p>
          </div>
        )}

        {scenario && (
          <>
            {/* ── Row 1: Timeline + Root-Cause Hypotheses (Items 4, 5, 6, 7, 8) ── */}
            <div className="cp-row cp-row-half">
              <Timeline events={scenario.timeline} />
              <Hypotheses hypotheses={scenario.hypotheses} />
            </div>

            {/* ── Row 2: Risk & Approval Controls + Sandbox Simulation (Items 9, 10, 13) ── */}
            <div className="cp-row cp-row-half">
              <RiskApproval
                scenario={scenario}
                riskResult={riskResult}
                approvalState={workState.approvalState}
                onApprove={handleApprove}
                onReject={handleReject}
                onInvestigate={handleInvestigate}
              />
              <Sandbox
                scenario={scenario}
                simState={workState.simState}
                simResult={workState.simResult}
                approved={approved}
                onRun={handleRunSandbox}
              />
            </div>

            {/* ── Rollback Execute (INC-001 only, when sandbox passed and safe) ── */}
            {workState.simState === "pass" && scenario.recommended_action.action_type === "rollback" && scenario.recommended_action.rollback_safe && !workState.rollbackDone && (
              <div className="cp-panel" style={{ marginBottom: 16 }}>
                <div className="cp-panel-header">
                  <RotateCcw size={18} className="cp-panel-icon" />
                  <h2>Execute Rollback</h2>
                  <span className="cp-badge cp-sev-low">SANDBOX PASSED</span>
                </div>
                <p className="cp-muted" style={{ marginBottom: 14, fontSize: 13 }}>
                  Sandbox simulation passed. Roll back{" "}
                  <strong className="cp-text">{scenario.incident.service}</strong> to{" "}
                  <strong className="cp-text">{scenario.recommended_action.target_version}</strong>.
                </p>
                <button className="cp-btn cp-btn-success" onClick={handleRollback}>
                  <RotateCcw size={15} /> Execute Rollback to {scenario.recommended_action.target_version}
                </button>
              </div>
            )}

            {workState.rollbackDone && (
              <div className="cp-alert cp-alert-success" style={{ marginBottom: 16, borderRadius: 10 }}>
                ✓ Rollback to {scenario.recommended_action.target_version} executed successfully.
                Service health restored to verified baseline.
              </div>
            )}

            {/* ── Audit Trail ── */}
            <AuditTrail logs={auditLogs} />

            {/* ── Row 3: Evaluation Harness + Monitoring ── */}
            <div className="cp-row cp-row-half">
              <Evaluation />
              <Monitoring />
            </div>
          </>
        )}
      </main>

      <footer className="cp-footer">
        <span>SIH 2026 — Incident Diagnosis &amp; Control Plane</span>
        <span>Connected to Reasoning Engine at {BACKEND_URL}</span>
      </footer>
    </div>
  );
}