"""
Correlation Engine
Merges data from Elasticsearch (logs, traces) and Prometheus (metrics)
into a unified investigation context.

This engine NEVER reads ground truth. It works only from observable data.
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
        """
        Pull all observability data for the incident and return a unified context.
        Returns:
            {
              logs, error_logs, traces, trace_map,
              metrics, log_summary, deployments,
              known_good_versions, service_dependencies
            }
        """
        incident_id = scenario["incident_id"]
        services = scenario.get("services", [])

        # 1. Logs from Elasticsearch
        logs = self.es.get_logs(incident_id)
        error_logs = self.es.get_error_logs(incident_id)
        log_summary = self.es.get_log_pattern_summary(incident_id)

        # 2. Traces from Elasticsearch
        traces = self.es.get_traces(incident_id)
        trace_map = self._build_trace_map(traces)

        # 3. Metrics from Prometheus per service
        metrics: Dict[str, Any] = {}
        for svc in services:
            metrics[svc] = self.prom.get_service_snapshot(svc)

        # 4. Deployment metadata from scenario (no ground truth here)
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
        }

    def _build_trace_map(self, traces: List[Dict]) -> Dict[str, List[Dict]]:
        """Group trace spans by trace_id for cross-service correlation."""
        trace_map: Dict[str, List[Dict]] = {}
        for span in traces:
            tid = span.get("trace_id")
            if tid:
                trace_map.setdefault(tid, []).append(span)
        # Sort each trace by timestamp
        for tid in trace_map:
            trace_map[tid].sort(key=lambda s: s.get("timestamp", ""))
        return trace_map
