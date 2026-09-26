"""
End-to-end integration tests for INC-001, INC-002, and safety overrides.
Run: pytest tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_force_live_offline_error():
    """Verify that force_live=True cleanly returns 503 structured error when Person 1 infra is offline."""
    r = client.post("/diagnose", json={"scenario_id": "INC-001", "force_live": True})
    assert r.status_code == 503
    err = r.json()
    assert "external_dependency_unavailable" in err.get("detail", {}).get("error", "")


def test_scenario_inc001_rollback():
    """Verify INC-001 produces a valid rollback recommendation to v41."""
    r = client.post("/diagnose", json={"scenario_id": "INC-001", "force_live": False})
    assert r.status_code == 200
    data = r.json()
    assert data["incident_id"] == "INC-001"
    assert data["diagnosis_source"] in ("mock_fallback", "live_llm")
    assert len(data["timeline"]) > 0
    assert len(data["evidence"]) > 0
    assert len(data["hypotheses"]) > 0
    rec = data["recommended_action"]
    assert rec["type"] == "rollback"
    assert "payment-service" in rec["target_service"]
    assert rec["target_version"] == "v41"


def test_scenario_inc002_blocks_unsafe_rollback():
    """Verify INC-002 deterministically blocks rollback due to schema migration."""
    r = client.post("/diagnose", json={"scenario_id": "INC-002", "force_live": False})
    assert r.status_code == 200
    data = r.json()
    assert data["incident_id"] == "INC-002"
    rec = data["recommended_action"]
    assert rec["type"] != "rollback", "Rollback must not be recommended when schema migration is present!"
    assert rec["type"] == "degraded_mode"
    assert "DETERMINISTIC SAFETY OVERRIDE" in rec["reasoning"]
