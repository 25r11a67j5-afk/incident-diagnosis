/**
 * mockScenarios.js
 * ----------------
 * Local mock data for Scenario 1 (Deployment Regression) and
 * Scenario 2 (DB Schema Migration).
 *
 * Shape matches the PRD contract so the real backend can drop in
 * without changing any component code.
 */

// ---------------------------------------------------------------------------
// Scenario 1 — Deployment Regression
// ---------------------------------------------------------------------------
export const SCENARIO_1 = {
  scenario_id: "1",
  scenario_name: "Deployment Regression",
  incident: {
    incident_id: "INC-001",
    service: "payment-service",
    description: "Error rate spiked to 31% after deployment of v42. P99 latency degraded to 2400ms.",
    detected_at: "2026-09-26T07:41:00Z",
  },
  timeline: [
    {
      timestamp: "2026-09-26T07:38:00Z",
      service: "payment-service",
      event_type: "deployment",
      summary: "Deployment v42 pushed to payment-service (replaces v41)",
      source: "deployment_metadata",
      severity: "info",
    },
    {
      timestamp: "2026-09-26T07:40:30Z",
      service: "payment-service",
      event_type: "metric_anomaly",
      summary: "Error rate spiked from 0.1% → 31% within 90 seconds of deployment",
      source: "Prometheus",
      severity: "critical",
    },
    {
      timestamp: "2026-09-26T07:41:00Z",
      service: "payment-service",
      event_type: "log_pattern",
      summary: "ConnectionTimeout exceptions appearing in payment-service logs",
      source: "Elasticsearch",
      severity: "critical",
    },
    {
      timestamp: "2026-09-26T07:41:15Z",
      service: "api-gateway",
      event_type: "metric_anomaly",
      summary: "P99 latency on /checkout rose from 120ms → 2400ms",
      source: "Prometheus",
      severity: "high",
    },
    {
      timestamp: "2026-09-26T07:42:00Z",
      service: "order-service",
      event_type: "metric_anomaly",
      summary: "Downstream order-service timeout rate elevated (18%)",
      source: "Prometheus",
      severity: "medium",
    },
  ],
  hypotheses: [
    {
      hypothesis_id: "H-001",
      cause: "Deployment regression — v42 introduced breaking change",
      confidence: 0.87,
      evidence: [
        { description: "Temporal correlation: error spike within 90s of deployment", source: "Prometheus" },
        { description: "Error rate spike: 0.1% → 31% post-deploy", source: "Prometheus" },
        { description: "Deployment v42 detected in deployment metadata", source: "deployment_metadata" },
        { description: "ConnectionTimeout pattern in logs matches known v42 regression", source: "Elasticsearch" },
      ],
    },
    {
      hypothesis_id: "H-002",
      cause: "External dependency degradation (payment gateway)",
      confidence: 0.13,
      evidence: [
        { description: "No external gateway alerts detected", source: "Prometheus" },
        { description: "Error pattern isolated to payment-service only", source: "Elasticsearch" },
      ],
    },
  ],
  recommended_action: {
    action_type: "rollback",
    target_service: "payment-service",
    target_version: "v41",
    rationale: "v41 is the last known-good version. Temporal correlation strongly indicates v42 regression.",
    rollback_safe: true,
    approval_required: true,
  },
  policy: {
    is_rollback: true,
    has_known_good_version: true,
    rollback_safe: true,
    temporal_correlation: true,
    rollback_eligible: true,
    unsafe_reason: null,
  },
  sandbox_result: {
    status: "pass",
    health_before: { error_rate: 31.0, p99_latency_ms: 2400 },
    health_after:  { error_rate: 0.2,  p99_latency_ms: 120 },
    message: "Rollback to v41 simulated. Health metrics recovered to baseline.",
    checks_run: 8,
    checks_passed: 8,
  },
};

// ---------------------------------------------------------------------------
// Scenario 2 — DB Schema Migration
// ---------------------------------------------------------------------------
export const SCENARIO_2 = {
  scenario_id: "2",
  scenario_name: "DB Schema Migration",
  incident: {
    incident_id: "INC-002",
    service: "user-service",
    description: "Login failure rate at 44% following DB schema migration. Incompatible column types after migration run.",
    detected_at: "2026-09-26T09:05:00Z",
  },
  timeline: [
    {
      timestamp: "2026-09-26T09:00:00Z",
      service: "user-service",
      event_type: "schema_migration",
      summary: "DB schema migration executed — column 'user_meta' changed from JSON to JSONB with constraints",
      source: "deployment_metadata",
      severity: "info",
    },
    {
      timestamp: "2026-09-26T09:02:30Z",
      service: "user-service",
      event_type: "metric_anomaly",
      summary: "Login failure rate climbed from 0.3% → 44% within 150s of migration",
      source: "Prometheus",
      severity: "critical",
    },
    {
      timestamp: "2026-09-26T09:03:00Z",
      service: "user-service",
      event_type: "log_pattern",
      summary: "DataTypeException: cannot cast legacy JSON to JSONB constraint in user_meta column",
      source: "Elasticsearch",
      severity: "critical",
    },
    {
      timestamp: "2026-09-26T09:04:00Z",
      service: "auth-service",
      event_type: "metric_anomaly",
      summary: "Auth-service token issuance rate dropped 42% (downstream of user-service)",
      source: "Prometheus",
      severity: "high",
    },
    {
      timestamp: "2026-09-26T09:05:00Z",
      service: "session-service",
      event_type: "metric_anomaly",
      summary: "Session creation failures elevated — 38% of new sessions failing",
      source: "Prometheus",
      severity: "medium",
    },
  ],
  hypotheses: [
    {
      hypothesis_id: "H-001",
      cause: "DB schema migration introduced incompatible column type constraint",
      confidence: 0.92,
      evidence: [
        { description: "Temporal correlation: login failures within 150s of migration", source: "Prometheus" },
        { description: "DataTypeException pattern matches JSONB migration constraint", source: "Elasticsearch" },
        { description: "Schema migration recorded in deployment metadata", source: "deployment_metadata" },
        { description: "Failures isolated to user_meta column reads/writes", source: "Elasticsearch" },
      ],
    },
    {
      hypothesis_id: "H-002",
      cause: "ORM version mismatch with new schema",
      confidence: 0.08,
      evidence: [
        { description: "ORM version unchanged in this deployment cycle", source: "deployment_metadata" },
      ],
    },
  ],
  recommended_action: {
    action_type: "degraded_mode",
    target_service: "user-service",
    target_version: null,
    rationale: "Schema migration detected. Rollback may cause data corruption due to JSONB rows written after migration. Activate degraded_mode to serve cached auth while engineers hotfix the constraint.",
    rollback_safe: false,
    approval_required: true,
  },
  policy: {
    is_rollback: false,
    has_known_good_version: true,
    rollback_safe: false,
    temporal_correlation: true,
    rollback_eligible: false,
    unsafe_reason: "Schema migration detected — rollback may cause data corruption in user_meta column (JSONB rows written post-migration cannot be safely reverted).",
  },
  sandbox_result: {
    status: "fail",
    health_before: { error_rate: 44.0, p99_latency_ms: 3100 },
    health_after:  { error_rate: 44.0, p99_latency_ms: 3100 },
    message: "Rollback aborted — policy check failed. Rollback_safe=false. Degraded mode simulation would succeed (run with action_type=degraded_mode).",
    checks_run: 8,
    checks_passed: 3,
  },
};

export const SCENARIOS = {
  "1": SCENARIO_1,
  "2": SCENARIO_2,
  "INC-001": SCENARIO_1,
  "INC-002": SCENARIO_2,
};
