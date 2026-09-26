"""
Prometheus client — queries metrics via PromQL HTTP API.
"""
from __future__ import annotations
import os
from typing import Any, Dict, List, Optional
import httpx


class PromClient:
    def __init__(self, host: str = None):
        self.host = host or os.getenv("PROMETHEUS_HOST", "http://localhost:9090")

    def is_healthy(self) -> bool:
        try:
            r = httpx.get(f"{self.host}/-/ready", timeout=2)
            return r.status_code == 200
        except Exception:
            return False

    def query(self, promql: str) -> List[Dict]:
        """Instant query."""
        try:
            r = httpx.get(f"{self.host}/api/v1/query", params={"query": promql}, timeout=5)
            data = r.json()
            return data["data"]["result"] if data["status"] == "success" else []
        except Exception:
            return []

    def query_range(self, promql: str, start: str, end: str, step: str = "30s") -> List[Dict]:
        """Range query."""
        try:
            r = httpx.get(
                f"{self.host}/api/v1/query_range",
                params={"query": promql, "start": start, "end": end, "step": step},
                timeout=10
            )
            data = r.json()
            return data["data"]["result"] if data["status"] == "success" else []
        except Exception:
            return []

    def get_service_snapshot(self, service: str) -> Dict[str, Any]:
        """Pull current key metrics for a service."""
        def scalar(results) -> Optional[float]:
            if results and results[0].get("value"):
                try:
                    return float(results[0]["value"][1])
                except (IndexError, ValueError):
                    return None
            return None

        return {
            "service": service,
            "error_rate":    scalar(self.query(f'http_error_rate{{service="{service}"}}')),
            "p99_latency_ms": scalar(self.query(f'http_latency_p99_ms{{service="{service}"}}')),
            "request_rate":  scalar(self.query(f'http_request_rate{{service="{service}"}}')),
            "cpu_percent":   scalar(self.query(f'service_cpu_percent{{service="{service}"}}')),
            "db_connections": scalar(self.query(f'db_pool_active{{service="{service}"}}')),
        }
