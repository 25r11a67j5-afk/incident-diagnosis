"""
Timeline Builder
Produces a chronological, human-readable event stream from correlated data.
Sources: deployments, error logs, trace anomalies, metric spikes.
"""
from __future__ import annotations
from typing import Any, Dict, List
from app.models.schemas import TimelineEvent


def build_timeline(correlated: Dict[str, Any]) -> List[Dict]:
    events: List[Dict] = []

    # 1. Deployment events
    for dep in correlated.get("deployments", []):
        changes = ", ".join(dep.get("changes", []))
        events.append({
            "timestamp": dep["deployed_at"],
            "service": dep["service"],
            "summary": f"Deployed {dep['version']} (prev: {dep['previous_version']}): {changes}",
            "event_type": "deployment",
            "source": "deployment_metadata",
        })

    # 2. Error and critical log events (capped at 15 most relevant)
    for log in correlated.get("error_logs", [])[:15]:
        events.append({
            "timestamp": log["timestamp"],
            "service": log["service"],
            "summary": f"[{log['level']}] {log['message'][:140]}",
            "event_type": "log_error" if log["level"] == "ERROR" else "incident_declared",
            "source": "elasticsearch_logs",
        })

    # 3. Anomalous trace spans (duration > 5s or ERROR status)
    seen_traces = set()
    for span in correlated.get("traces", []):
        if span.get("status") == "ERROR" and span.get("trace_id") not in seen_traces:
            seen_traces.add(span["trace_id"])
            events.append({
                "timestamp": span["timestamp"],
                "service": span["service"],
                "summary": f"Trace {span['trace_id'][:12]}: {span['operation']} failed ({span['duration_ms']}ms)",
                "event_type": "trace_anomaly",
                "source": "elasticsearch_traces",
            })

    # 4. Metric anomaly events (from Prometheus data in correlated context)
    for svc, m in correlated.get("metrics", {}).items():
        if m.get("error_rate") and m["error_rate"] > 0.05:
            events.append({
                "timestamp": correlated.get("logs", [{}])[-1].get("timestamp", ""),
                "service": svc,
                "summary": f"Error rate anomaly: {m['error_rate']*100:.1f}% (threshold: 5%)",
                "event_type": "metric_anomaly",
                "source": "prometheus",
            })
        if m.get("p99_latency_ms") and m["p99_latency_ms"] > 1000:
            events.append({
                "timestamp": correlated.get("logs", [{}])[-1].get("timestamp", ""),
                "service": svc,
                "summary": f"Latency anomaly: p99={m['p99_latency_ms']}ms (threshold: 1000ms)",
                "event_type": "metric_anomaly",
                "source": "prometheus",
            })

    # Sort chronologically, deduplicate
    events.sort(key=lambda e: e.get("timestamp", ""))
    return events
