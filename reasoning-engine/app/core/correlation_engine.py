"""
Correlation Engine
Merges data from Elasticsearch (logs, traces) and Prometheus (metrics)
into a unified investigation context.
Never reads ground truth.
Accurately records whether data originates from live systems or mock scenario data.
"""
from __future__ import annotations
from typing import Any, Dict, List
from app.clients.es_client import ESClient
from app.clients.prom_client import PromClient


class CorrelationEngine:
    def __init__(self, es: ESClient, prom: PromClient):
        self.es = es
        self.prom = prom

    def correlate(self, scenario: Dict[str, Any]) -> Dict[str, Any]:
        # Ground truth is NEVER allowed in the diagnosis path
        scenario.pop("ground_truth", None)

        incident_id = scenario["incident_id"]
        services = scenario.get("services", [])

        es_healthy = self.es.is_healthy()
        prom_healthy = self.prom.is_healthy()

        source_origins = {
            "es_live": es_healthy,
            "prom_live": prom_healthy,
            "logs": "elasticsearch_logs" if es_healthy else "mock_scenario_logs",
            "traces": "elasticsearch_traces" if es_healthy else "mock_scenario_traces",
            "metrics": "prometheus" if prom_healthy else "mock_scenario_metrics",
        }

        # 1. Logs & Traces
        if es_healthy:
            logs = self.es.get_logs(incident_id)
            error_logs = self.es.get_error_logs(incident_id)
            log_summary = self.es.get_log_pattern_summary(incident_id)
            traces = self.es.get_traces(incident_id)
        else:
            logs = scenario.get("logs", [])
            error_logs = [l for l in logs if l.get("level") in ("ERROR", "CRITICAL")]
            traces = scenario.get("traces", [])
            log_summary = {}
            for l in logs:
                svc = l.get("service")
                lvl = l.get("level")
                if svc and lvl:
                    log_summary.setdefault(svc, {})
                    log_summary[svc][lvl] = log_summary[svc].get(lvl, 0) + 1

        trace_map = self._build_trace_map(traces)

        # 2. Metrics
        metrics: Dict[str, Any] = {}
        if prom_healthy:
            for svc in services:
                metrics[svc] = self.prom.get_service_snapshot(svc)
        else:
            snapshot = scenario.get("metrics_snapshot", {})
            for svc in services:
                s_data = snapshot.get(svc, {})
                metrics[svc] = {
                    "service": svc,
                    "error_rate": s_data.get("error_rate"),
                    "p99_latency_ms": s_data.get("p99_latency_ms"),
                    "request_rate": s_data.get("request_rate"),
                    "cpu_percent": s_data.get("cpu_percent"),
                    "db_connections": s_data.get("db_connections_active") or s_data.get("db_connections"),
                }

        # 3. Metadata
        deployments = scenario.get("deployments", [])
        known_good = scenario.get("known_good_versions", {})
        dependencies = scenario.get("service_dependencies", {})
        external_deps = scenario.get("external_dependencies", [])
        db_state = scenario.get("database_state", None)

        return {
            "incident_id": incident_id,
            "services": services,
            "logs": logs,
            "error_logs": error_logs,
            "log_summary": log_summary,
            "traces": traces,
            "trace_map": trace_map,
            "metrics": metrics,
            "deployments": deployments,
            "known_good_versions": known_good,
            "service_dependencies": dependencies,
            "external_dependencies": external_deps,
            "database_state": db_state,
            "source_origins": source_origins,
        }

    def _build_trace_map(self, traces: List[Dict]) -> Dict[str, List[Dict]]:
        trace_map: Dict[str, List[Dict]] = {}
        for span in traces:
            tid = span.get("trace_id")
            if tid:
                trace_map.setdefault(tid, []).append(span)
        for tid in trace_map:
            trace_map[tid].sort(key=lambda s: s.get("timestamp", ""))
        return trace_map
