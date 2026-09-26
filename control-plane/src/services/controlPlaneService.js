/**
 * controlPlaneService.js  (v2 — PRD-aligned)
 * -------------------------------------------
 * Service layer for the Control Plane UI.
 *
 * Strategy:
 *   1. Try real backend at BACKEND_URL.
 *   2. If unavailable (network error / timeout), fall back to mock data.
 *   3. If USE_CACHE flag is set, skip the network call entirely.
 *
 * Backend integration points are marked with: // BACKEND:
 */

import { SCENARIOS } from "../data/mockScenarios.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** BACKEND: Set to real backend URL when available. */
export const BACKEND_URL = "http://localhost:5002";

/** BACKEND: Set to real Grafana URL. */
export const GRAFANA_URL = "http://localhost:3001";

// Timeout for backend calls (ms)
const TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Backend availability detection
// ---------------------------------------------------------------------------

let _backendAvailable = null; // null = not yet checked

export async function checkBackendAvailability() {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
    clearTimeout(tid);
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

export function isBackendAvailable() {
  return _backendAvailable === true;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postWithTimeout(url, body) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) {
      let errDetail = null;
      try {
        errDetail = await res.json();
      } catch {
        // non-json response
      }
      const err = new Error(
        errDetail?.detail?.message ||
        errDetail?.detail?.error ||
        `Backend returned HTTP ${res.status}: ${res.statusText}`
      );
      err.status = res.status;
      err.detail = errDetail?.detail;
      err.hint = errDetail?.detail?.hint;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Adapt backend DiagnosisResponse into the full scenario UI structure.
 */
function adaptBackendDiagnosis(backendResp, scenarioId) {
  const id = backendResp.incident_id || scenarioId;
  const isInc002 = id === "INC-002" || String(scenarioId).includes("2");

  const rec = backendResp.recommended_action || {};
  const isRollback = rec.type === "rollback";
  const reasoning = rec.reasoning || "";
  const isSafetyOverridden =
    reasoning.includes("DETERMINISTIC SAFETY OVERRIDE") ||
    reasoning.toLowerCase().includes("schema") ||
    isInc002;
  const rollbackSafe = isRollback && !isSafetyOverridden;

  // Format hypotheses with supporting and contradicting evidence objects
  const evidenceList = backendResp.evidence || [];
  const hypothesesList = (backendResp.hypotheses || []).map((h) => {
    const suppEv = evidenceList.filter(
      (e) => (h.evidence_ids && h.evidence_ids.includes(e.id)) || (e.supports_hypotheses && e.supports_hypotheses.includes(h.id))
    );
    const contraEv = evidenceList.filter(
      (e) => e.contradicts_hypotheses && e.contradicts_hypotheses.includes(h.id)
    );
    return {
      hypothesis_id: h.id,
      id: h.id,
      cause: h.cause,
      confidence: h.confidence,
      evidence_ids: h.evidence_ids || [],
      supporting_evidence: suppEv.length > 0 ? suppEv : evidenceList.slice(0, 3),
      contradicting_evidence: contraEv,
      // Backwards compatibility for components expecting .evidence array
      evidence: (suppEv.length > 0 ? suppEv : evidenceList.slice(0, 3)).map((e) => ({
        description: e.observation || e.type,
        source: e.source,
      })),
    };
  });

  return {
    scenario_id: isInc002 ? "2" : "1",
    scenario_name: isInc002 ? "DB Schema Migration" : "Deployment Regression",
    incident: {
      incident_id: id,
      service: rec.target_service || (isInc002 ? "user-service" : "payment-service"),
      severity: "P1",
      status: "INVESTIGATED",
      description: isInc002
        ? "User service errors following v15 deployment with DB schema migration."
        : "Error rate spiked to 31% after deployment of v42. P99 latency degraded to 2400ms.",
      affected_services: isInc002
        ? ["user-service", "api-gateway", "auth-service"]
        : ["payment-service", "api-gateway", "order-service"],
      customer_impact: isInc002
        ? "15% user registration & login failure rate, cascading auth errors"
        : "31% payment failure rate, checkout P99 latency degraded to 2400ms",
      detected_at: isInc002 ? "2026-09-26T09:20:00Z" : "2026-09-26T10:07:00Z",
    },
    timeline: (backendResp.timeline || []).map((t) => ({
      timestamp: t.timestamp,
      service: t.service,
      event_type: t.event_type,
      summary: t.summary,
      source: t.source,
      severity: t.event_type.includes("error") || t.event_type.includes("anomaly") ? "critical" : "info",
    })),
    evidence: evidenceList,
    hypotheses: hypothesesList,
    recommended_action: {
      action_type: rec.type,
      type: rec.type,
      category: rec.category,
      target_service: rec.target_service,
      target_version: rec.target_version,
      rationale: reasoning,
      reasoning: reasoning,
      is_reversible: rec.is_reversible,
      expected_recovery: rec.expected_recovery,
      rollback_safe: rollbackSafe,
      approval_required: true,
    },
    permanent_remediation_suggestion: backendResp.permanent_remediation_suggestion,
    policy: {
      is_rollback: isRollback,
      has_known_good_version: Boolean(rec.target_version),
      rollback_safe: rollbackSafe,
      temporal_correlation: true,
      rollback_eligible: rollbackSafe,
      unsafe_reason: !rollbackSafe
        ? (reasoning.includes("DETERMINISTIC SAFETY OVERRIDE")
            ? "Database schema migration detected — rollback is unsafe because v14 binary cannot handle the modified schema without crashing. Deterministic safety override active."
            : "Database schema migration detected; rollback is unsafe.")
        : null,
    },
    sandbox_result: isInc002
      ? {
          status: "fail",
          health_before: { error_rate: 15.0, p99_latency_ms: 800 },
          health_after: { error_rate: 15.0, p99_latency_ms: 800 },
          message: "Rollback aborted — policy check failed. Database schema migration detected (rollback_safe=false). Alternative remediation: operate in degraded mode.",
          checks_run: 8,
          checks_passed: 2,
        }
      : {
          status: "pass",
          health_before: { error_rate: 31.0, p99_latency_ms: 2400 },
          health_after: { error_rate: 0.2, p99_latency_ms: 120 },
          message: "Rollback to v41 simulated. Health metrics recovered to baseline.",
          checks_run: 8,
          checks_passed: 8,
        },
    diagnosis_source: backendResp.diagnosis_source || "live_llm",
    diagnosis_time_ms: backendResp.diagnosis_time_ms || 0,
    data_sources_queried: backendResp.data_sources_queried || ["elasticsearch_logs", "prometheus", "deployment_metadata"],
    evidence_sufficient: backendResp.evidence_sufficient ?? true,
    missing_evidence: backendResp.missing_evidence,
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Load scenario data.
 * BACKEND: GET ${BACKEND_URL}/scenario/:id
 */
export async function getScenario(scenarioId) {
  await delay(100);
  return SCENARIOS[String(scenarioId)] ?? null;
}

/**
 * Run full diagnosis for a scenario.
 * BACKEND: POST ${BACKEND_URL}/diagnose  { scenario_id, force_live }
 *
 * Returns the full adapted scenario object.
 */
export async function diagnoseIncident(scenarioId, forceLive = false) {
  const canonicalId =
    scenarioId === "2" || scenarioId === "INC-002" ? "INC-002" : "INC-001";

  // Try real backend
  try {
    const data = await postWithTimeout(`${BACKEND_URL}/diagnose`, {
      scenario_id: canonicalId,
      force_live: forceLive,
    });
    _backendAvailable = true;
    const adapted = adaptBackendDiagnosis(data, canonicalId);
    return { data: adapted, source: data.diagnosis_source || "backend" };
  } catch (err) {
    // If backend returned a structured error (like 503 external_dependency_unavailable),
    // propagate it so UI can render the exact diagnostic hint.
    if (err.status) {
      throw err;
    }
    _backendAvailable = false;
    throw err;
  }
}

/**
 * Get the timeline events for a scenario.
 * BACKEND: GET ${BACKEND_URL}/timeline/:scenarioId
 */
export async function getTimeline(scenarioId) {
  await delay(80);
  return SCENARIOS[String(scenarioId)]?.timeline ?? [];
}

/**
 * Get hypotheses for a scenario.
 * BACKEND: GET ${BACKEND_URL}/hypotheses/:scenarioId
 */
export async function getHypotheses(scenarioId) {
  await delay(80);
  return SCENARIOS[String(scenarioId)]?.hypotheses ?? [];
}

/**
 * Approve the recommended action.
 * BACKEND: POST ${BACKEND_URL}/approve  { scenario_id, incident_id, action_type, actor }
 */
export async function approveAction(scenarioId, incidentId, actionType, actor = "Operator-01") {
  await delay(400);
  return {
    approved: true,
    scenario_id: scenarioId,
    incident_id: incidentId,
    action_type: actionType,
    actor,
    approved_at: new Date().toISOString(),
  };
}

/**
 * Reject the recommended action.
 * BACKEND: POST ${BACKEND_URL}/reject  { scenario_id, incident_id, actor, reason }
 */
export async function rejectAction(scenarioId, incidentId, actor = "Operator-01", reason = "Manual rejection") {
  await delay(300);
  return {
    rejected: true,
    scenario_id: scenarioId,
    incident_id: incidentId,
    actor,
    reason,
    rejected_at: new Date().toISOString(),
  };
}

/**
 * Run sandbox simulation.
 * BACKEND: POST ${BACKEND_URL}/sandbox  { scenario_id, action_type }
 */
export async function runSandbox(scenarioId, actionType) {
  await delay(2000); // simulate running
  const scenario = SCENARIOS[String(scenarioId)];
  if (!scenario) throw new Error("Unknown scenario");

  // If rollback_safe=false and action is rollback → sandbox FAIL
  if (actionType === "rollback" && !scenario.recommended_action.rollback_safe) {
    return {
      ...scenario.sandbox_result,
      status: "fail",
      message: "Rollback aborted — policy check failed. rollback_safe=false.",
    };
  }

  return scenario.sandbox_result;
}

/**
 * Execute the approved rollback action.
 * BACKEND: POST ${BACKEND_URL}/rollback  { scenario_id, incident_id, target_version }
 */
export async function rollbackAction(scenarioId, incidentId, targetVersion) {
  await delay(1500);
  return {
    success: true,
    scenario_id: scenarioId,
    incident_id: incidentId,
    target_version: targetVersion,
    executed_at: new Date().toISOString(),
    message: `Rollback to ${targetVersion} executed successfully.`,
  };
}
