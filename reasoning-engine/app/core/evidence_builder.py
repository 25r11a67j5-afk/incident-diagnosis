"""
Evidence Builder
Produces structured Evidence objects from correlated data.
Evidence is first-class: each piece has source, type, weight, and hypothesis links.
Never fakes live sources when mock fallback is used.
"""
from __future__ import annotations
from typing import Any, Dict, List


def build_evidence(correlated: Dict[str, Any]) -> List[Dict]:
    evidence: List[Dict] = []
    eid = 1

    source_origins = correlated.get("source_origins", {})
    logs_source = source_origins.get("logs", "elasticsearch_logs")
    traces_source = source_origins.get("traces", "elasticsearch_traces")
    metrics_source = source_origins.get("metrics", "prometheus")

    def new_id():
        nonlocal eid
        e = f"E-{eid:03d}"
        eid += 1
        return e

    # 1. Deployment temporal correlation
    for dep in correlated.get("deployments", []):
        evidence.append({
            "id": new_id(),
            "source": "deployment_metadata",
            "type": "temporal_correlation",
            "service": dep["service"],
            "timestamp": dep["deployed_at"],
            "observation": (
                f"Service {dep['service']} deployed version {dep['version']} "
                f"(prev: {dep['previous_version']}) at {dep['deployed_at']}. "
                f"Changes: {', '.join(dep.get('changes', []))}"
            ),
            "query_used": None,
            "raw_value": None,
            "baseline_value": None,
            "deviation_factor": None,
            "supports_hypotheses": [],
            "contradicts_hypotheses": [],
            "weight": 0.70,
        })

    # 2. Known-good baseline comparison
    for svc, kg in correlated.get("known_good_versions", {}).items():
        baseline = kg.get("baseline_metrics", {})
        current = correlated.get("metrics", {}).get(svc, {})
        if baseline and current:
            err_base = baseline.get("error_rate", 0)
            err_now = current.get("error_rate") or 0
            if err_now > err_base * 5:
                deviation = round(err_now / err_base, 1) if err_base > 0 else None
                evidence.append({
                    "id": new_id(),
                    "source": "deployment_metadata",
                    "type": "baseline_comparison",
                    "service": svc,
                    "timestamp": kg.get("health_verified_at", ""),
                    "observation": (
                        f"{svc} last known healthy at v{kg['version']} "
                        f"(error_rate={err_base*100:.1f}%). "
                        f"Current error_rate={err_now*100:.1f}% - "
                        f"{deviation}x deviation from baseline."
                    ),
                    "query_used": None,
                    "raw_value": float(err_now),
                    "baseline_value": float(err_base),
                    "deviation_factor": float(deviation) if deviation else None,
                    "supports_hypotheses": [],
                    "contradicts_hypotheses": [],
                    "weight": 0.80,
                })

    # 3. Metric anomalies
    for svc, m in correlated.get("metrics", {}).items():
        err = m.get("error_rate")
        if err is not None and err > 0.05:
            evidence.append({
                "id": new_id(),
                "source": metrics_source,
                "type": "metric_anomaly",
                "service": svc,
                "timestamp": "",
                "observation": f"{svc} error rate: {err*100:.1f}% (threshold 5%)",
                "query_used": f'http_error_rate{{service="{svc}"}}',
                "raw_value": float(err),
                "baseline_value": 0.002,
                "deviation_factor": round(err / 0.002, 1),
                "supports_hypotheses": [],
                "contradicts_hypotheses": [],
                "weight": 0.85,
            })
        lat = m.get("p99_latency_ms")
        if lat is not None and lat > 1000:
            evidence.append({
                "id": new_id(),
                "source": metrics_source,
                "type": "metric_anomaly",
                "service": svc,
                "timestamp": "",
                "observation": f"{svc} p99 latency: {lat}ms (threshold 1000ms)",
                "query_used": f'http_latency_p99_ms{{service="{svc}"}}',
                "raw_value": float(lat),
                "baseline_value": 120.0,
                "deviation_factor": round(lat / 120, 1),
                "supports_hypotheses": [],
                "contradicts_hypotheses": [],
                "weight": 0.75,
            })

    # 4. Log patterns
    log_summary = correlated.get("log_summary", {})
    for svc, levels in log_summary.items():
        error_count = levels.get("ERROR", 0) + levels.get("CRITICAL", 0)
        if error_count > 0:
            evidence.append({
                "id": new_id(),
                "source": logs_source,
                "type": "log_pattern",
                "service": svc,
                "timestamp": "",
                "observation": f"{svc} produced {error_count} ERROR/CRITICAL log entries during incident window",
                "query_used": f"index:logs-{correlated['incident_id'].lower()} level:(ERROR OR CRITICAL) service:{svc}",
                "raw_value": float(error_count),
                "baseline_value": 0.0,
                "deviation_factor": None,
                "supports_hypotheses": [],
                "contradicts_hypotheses": [],
                "weight": 0.65,
            })

    # 5. Trace correlation
    error_traces = [
        tid for tid, spans in correlated.get("trace_map", {}).items()
        if any(s.get("status") == "ERROR" for s in spans)
    ]
    if error_traces:
        involved = set()
        for tid in error_traces:
            for span in correlated["trace_map"][tid]:
                involved.add(span.get("service", ""))
        evidence.append({
            "id": new_id(),
            "source": traces_source,
            "type": "trace_correlation",
            "service": correlated["services"][0] if correlated["services"] else "unknown",
            "timestamp": "",
            "observation": (
                f"{len(error_traces)} error trace(s) show failure propagation across: "
                f"{', '.join(sorted(involved))}"
            ),
            "query_used": f"index:traces-{correlated['incident_id'].lower()} status:ERROR",
            "raw_value": float(len(error_traces)),
            "baseline_value": 0.0,
            "deviation_factor": None,
            "supports_hypotheses": [],
            "contradicts_hypotheses": [],
            "weight": 0.70,
        })

    # 6. Database state (schema migrations)
    db_state = correlated.get("database_state")
    if db_state:
        evidence.append({
            "id": new_id(),
            "source": "deployment_metadata",
            "type": "schema_migration",
            "service": correlated["services"][0] if correlated["services"] else "unknown",
            "timestamp": db_state.get("migration_applied_at", ""),
            "observation": (
                f"Database schema migration detected: {db_state.get('migration_description', '')}. "
                f"Status: {db_state.get('migration_status', 'unknown')}. "
                f"Backward compatible: {db_state.get('backward_compatible', 'unknown')}. "
                f"{db_state.get('v14_compatibility', '')}"
            ),
            "query_used": None,
            "raw_value": None,
            "baseline_value": None,
            "deviation_factor": None,
            "supports_hypotheses": [],
            "contradicts_hypotheses": [],
            "weight": 0.90,
        })

    # 7. External dependency degradation
    for ext in correlated.get("external_dependencies", []):
        if ext.get("status") == "degraded":
            evidence.append({
                "id": new_id(),
                "source": "deployment_metadata",
                "type": "dependency_degradation",
                "service": ext.get("service", "external"),
                "timestamp": ext.get("degraded_since", ""),
                "observation": f"External dependency {ext.get('name', 'service')} degraded: {ext.get('status_message', '')}",
                "query_used": None,
                "raw_value": None,
                "baseline_value": None,
                "deviation_factor": None,
                "supports_hypotheses": [],
                "contradicts_hypotheses": [],
                "weight": 0.75,
            })

    return evidence
