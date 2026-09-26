# Locked Contracts — Frozen at Minute 0

> Do NOT rename or remove fields after agreement. Additive changes only.

## 1. Scenario (Observable) — Person 1 → Person 2

Served at `GET /scenarios/:id` (port 5001).
**Ground truth is NOT in this object.**

```json
{
  "incident_id": "INC-001",
  "severity": "P1",
  "title": "Payment service degradation following v42 deployment",
  "declared_at": "2026-09-26T10:07:00Z",
  "services": ["payment-service", "api-gateway", "order-service"],
  "service_dependencies": {
    "api-gateway": ["payment-service", "order-service"],
    "order-service": ["payment-service"]
  },
  "elasticsearch": {
    "host": "http://localhost:9200",
    "log_index": "logs-inc-001",
    "trace_index": "traces-inc-001",
    "deployment_index": "deployments-inc-001"
  },
  "prometheus": {
    "host": "http://localhost:9090",
    "queries": {
      "error_rate": "http_error_rate{service='payment-service'}",
      "latency_p99": "http_latency_p99_ms{service='payment-service'}"
    }
  },
  "deployments": [
    {
      "service": "payment-service",
      "version": "v42",
      "previous_version": "v41",
      "commit": "abc123def",
      "deployed_at": "2026-09-26T10:00:00Z",
      "deployer": "ci-pipeline",
      "health_status_before": "healthy",
      "changes": ["Updated payment retry timeout from 5s to 30s", "Refactored connection pool"]
    }
  ],
  "known_good_versions": {
    "payment-service": {
      "version": "v41",
      "health_verified_at": "2026-09-26T09:58:00Z",
      "baseline_metrics": { "error_rate": 0.002, "p99_latency_ms": 120 }
    }
  }
}
```

## 2. Evidence Object — first-class, used throughout reasoning

```json
{
  "id": "E-001",
  "source": "prometheus",
  "type": "metric_anomaly",
  "service": "payment-service",
  "timestamp": "2026-09-26T10:04:00Z",
  "observation": "error rate increased from 0.2% to 31%",
  "query_used": "http_error_rate{service='payment-service'}",
  "raw_value": 0.31,
  "baseline_value": 0.002,
  "deviation_factor": 155,
  "supports_hypotheses": ["H-001"],
  "contradicts_hypotheses": [],
  "weight": 0.85
}
```

## 3. Diagnosis Response — Person 2 → Person 3

Returned by `POST /diagnose` (port 5002).

```json
{
  "incident_id": "INC-001",
  "diagnosis_source": "live_llm",
  "diagnosis_time_ms": 2340,
  "data_sources_queried": ["elasticsearch_logs", "elasticsearch_traces", "prometheus", "deployment_metadata"],
  "timeline": [
    {
      "timestamp": "2026-09-26T10:00:00Z",
      "service": "payment-service",
      "summary": "Deployed v42: Updated payment retry timeout from 5s to 30s",
      "event_type": "deployment",
      "source": "deployment_metadata"
    }
  ],
  "evidence": [
    {
      "id": "E-001",
      "source": "prometheus",
      "type": "metric_anomaly",
      "service": "payment-service",
      "timestamp": "2026-09-26T10:04:00Z",
      "observation": "error rate increased from 0.2% to 31%",
      "query_used": "http_error_rate{service='payment-service'}",
      "raw_value": 0.31,
      "baseline_value": 0.002,
      "deviation_factor": 155,
      "supports_hypotheses": ["H-001"],
      "contradicts_hypotheses": [],
      "weight": 0.85
    }
  ],
  "hypotheses": [
    {
      "id": "H-001",
      "cause": "Deployment v42 introduced retry timeout regression causing connection exhaustion",
      "confidence": 0.87,
      "evidence_ids": ["E-001", "E-002", "E-003"]
    }
  ],
  "recommended_action": {
    "type": "rollback",
    "category": "immediate_mitigation",
    "target_service": "payment-service",
    "target_version": "v41",
    "reasoning": "v42 is temporally correlated with degradation; v41 was healthy; rollback is reversible and bounded",
    "is_reversible": true,
    "expected_recovery": "Restore error rate to baseline 0.2%"
  },
  "permanent_remediation_suggestion": "Investigate retry timeout value — 30s is likely too long for payment gateway SLA",
  "evidence_sufficient": true,
  "missing_evidence": null
}
```

## 4. Risk & Execution Response — Person 3 (end of pipeline)

```json
{
  "incident_id": "INC-001",
  "risk_assessment": {
    "risk_score": 0.35,
    "impact": "medium",
    "reversibility": "full",
    "blast_radius": "single-service",
    "approval_required": true,
    "risk_dimensions": {
      "impact_score": 0.3,
      "reversibility_score": 1.0,
      "blast_radius_score": 0.2
    }
  },
  "rollback_policy": {
    "eligible": true,
    "checks": {
      "known_good_version_exists": true,
      "schema_migration_detected": false,
      "active_migration_running": false,
      "dependency_compatibility": true
    },
    "blocking_reason": null
  },
  "sandbox_result": {
    "executed": true,
    "health_before": { "error_rate": 0.31, "p99_latency_ms": 2400 },
    "health_after": { "error_rate": 0.002, "p99_latency_ms": 120 },
    "verdict": "pass",
    "notes": "Health metrics recovered to within 5% of baseline"
  },
  "execution_status": "completed",
  "audit_log": [
    {
      "timestamp": "2026-09-26T10:08:01Z",
      "action": "scenario_loaded",
      "actor": "system",
      "details": "Loaded INC-001"
    }
  ]
}
```

## 5. Ground Truth — Evaluation Harness ONLY

Served at `GET /scenarios/:id/ground-truth` (port 5001).
**NEVER sent to reasoning engine or sandbox. Used only for scoring.**

```json
{
  "incident_id": "INC-001",
  "actual_root_cause": "Deployment v42 introduced retry timeout regression",
  "correct_action": "rollback",
  "rollback_safe": true,
  "affected_service": "payment-service",
  "expected_health_after_correct_action": {
    "error_rate_lt": 0.01,
    "p99_latency_ms_lt": 200
  }
}
```
