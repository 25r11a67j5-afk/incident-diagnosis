"""
Smoke tests for the reasoning engine.
Run: pytest tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "data_sources" in data
    assert "groq_configured" in data


def test_diagnose_missing_scenario():
    r = client.post("/diagnose", json={"scenario_id": "INC-999"})
    assert r.status_code == 500  # sim API will 404, pipeline raises


def test_cache_list():
    r = client.get("/cache")
    assert r.status_code == 200
    assert "cached" in r.json()
