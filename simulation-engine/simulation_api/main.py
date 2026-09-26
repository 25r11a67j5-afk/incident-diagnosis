"""
Simulation Engine API
Person 1 owns this.

IMPORTANT: Ground truth is NEVER included in /scenarios/:id response.
           It is ONLY available at /scenarios/:id/ground-truth for the evaluation harness.
"""
import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Gauge, Counter, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

app = FastAPI(title="Simulation Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SCENARIOS_DIR = Path("/app/scenarios/observable")
EVAL_DIR = Path("/app/scenarios/evaluation")

# ── Prometheus metrics (exposed for Prometheus scraping) ─────────
error_rate_gauge = Gauge("http_error_rate", "HTTP error rate", ["service"])
latency_p99_gauge = Gauge("http_latency_p99_ms", "p99 latency ms", ["service"])
request_rate_gauge = Gauge("http_request_rate", "Requests/sec", ["service"])
cpu_gauge = Gauge("service_cpu_percent", "CPU usage %", ["service"])
db_connections_gauge = Gauge("db_pool_active", "Active DB connections", ["service"])

ACTIVE_SCENARIO: Optional[str] = None


def load_scenario_file(scenario_id: str, kind: str = "observable") -> dict:
    base = SCENARIOS_DIR if kind == "observable" else EVAL_DIR
    path = base / f"{scenario_id.lower()}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
    return json.loads(path.read_text())


def set_metrics_for_scenario(scenario_id: str):
    """Update Prometheus gauges to reflect the incident state."""
    scenario = load_scenario_file(scenario_id)
    snapshot = scenario.get("metrics_snapshot", {})
    for service, metrics in snapshot.items():
        error_rate_gauge.labels(service=service).set(metrics.get("error_rate", 0))
        latency_p99_gauge.labels(service=service).set(metrics.get("p99_latency_ms", 0))
        request_rate_gauge.labels(service=service).set(metrics.get("request_rate", 0))
        cpu_gauge.labels(service=service).set(metrics.get("cpu_percent", 0))
        db_connections_gauge.labels(service=service).set(metrics.get("db_connections_active", 0))


@app.get("/health")
def health():
    return {"status": "ok", "service": "simulation-engine", "active_scenario": ACTIVE_SCENARIO}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/scenarios")
def list_scenarios():
    scenarios = []
    for f in sorted(SCENARIOS_DIR.glob("*.json")):
        data = json.loads(f.read_text())
        scenarios.append({
            "incident_id": data["incident_id"],
            "severity": data["severity"],
            "title": data["title"],
            "declared_at": data["declared_at"],
        })
    return {"scenarios": scenarios}


@app.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    """Returns observable scenario data. Ground truth is EXCLUDED."""
    return load_scenario_file(scenario_id)


@app.get("/scenarios/{scenario_id}/ground-truth")
def get_ground_truth(scenario_id: str):
    """
    Returns ground truth for evaluation harness.
    WARNING: This endpoint must NEVER be called by the reasoning engine or control plane
    during the diagnosis or execution path. Only the evaluator uses this.
    """
    return load_scenario_file(scenario_id, kind="evaluation")


@app.post("/scenarios/{scenario_id}/inject")
def inject_fault(scenario_id: str):
    """Trigger fault injection — sets Prometheus metrics to incident state."""
    global ACTIVE_SCENARIO
    set_metrics_for_scenario(scenario_id)
    ACTIVE_SCENARIO = scenario_id
    return {
        "status": "injected",
        "scenario_id": scenario_id,
        "message": f"Fault injected for {scenario_id}. Prometheus metrics updated."
    }


@app.post("/scenarios/{scenario_id}/resolve")
def resolve_fault(scenario_id: str):
    """Reset metrics to healthy baseline after resolution."""
    global ACTIVE_SCENARIO
    scenario = load_scenario_file(scenario_id)
    for service in scenario.get("services", []):
        error_rate_gauge.labels(service=service).set(0.002)
        latency_p99_gauge.labels(service=service).set(120)
    ACTIVE_SCENARIO = None
    return {"status": "resolved", "scenario_id": scenario_id}
