"""
Simulation API client - fetches scenario observable data from Person 1 engine.
Ground truth endpoint is deliberately NOT called here.
Includes robust local mock fallback for codeathon resilience.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Dict, Any, List
import httpx


class ExternalDependencyError(RuntimeError):
    """Raised when an external live dependency (e.g. simulation API) is unavailable."""
    pass


class SimulationClient:
    def __init__(self, host: str = None):
        self.host = host or os.getenv("SIMULATION_API", "http://localhost:5001")

    def is_healthy(self) -> bool:
        try:
            r = httpx.get(f"{self.host}/health", timeout=1.5)
            return r.status_code == 200
        except Exception:
            return False

    def get_scenario(self, scenario_id: str, allow_mock_fallback: bool = True) -> Dict[str, Any]:
        """
        Fetch observable scenario.
        Primary: queries Person 1 simulation API at http://localhost:5001/scenarios/{id}.
        Fallback: loads local observable scenario file if simulation API is offline.
        Ground truth is NEVER returned or accessed here.
        """
        try:
            r = httpx.get(f"{self.host}/scenarios/{scenario_id}", timeout=2.5)
            r.raise_for_status()
            data = r.json()
            data.pop("ground_truth", None)
            return data
        except Exception as e:
            if not allow_mock_fallback:
                raise ExternalDependencyError(
                    f"Simulation API at {self.host} is unreachable ({type(e).__name__}: {e}). "
                    "Person 1 infrastructure is currently offline."
                )

            scenario_data = self._load_local_scenario(scenario_id)
            if scenario_data:
                scenario_data.pop("ground_truth", None)
                scenario_data["_is_mock_fallback"] = True
                return scenario_data

            raise FileNotFoundError(
                f"Scenario '{scenario_id}' could not be fetched from live API ({e}) "
                f"nor found in local observable scenarios."
            )

    def _load_local_scenario(self, scenario_id: str) -> Dict[str, Any] | None:
        """Search local repository for observable scenario file."""
        candidates = [
            Path(__file__).resolve().parents[3] / "simulation-engine" / "scenarios" / "observable" / f"{scenario_id.lower()}.json",
            Path(__file__).resolve().parents[2] / "simulation-engine" / "scenarios" / "observable" / f"{scenario_id.lower()}.json",
            Path.cwd() / ".." / "simulation-engine" / "scenarios" / "observable" / f"{scenario_id.lower()}.json",
            Path.cwd() / "simulation-engine" / "scenarios" / "observable" / f"{scenario_id.lower()}.json",
        ]
        for p in candidates:
            if p.exists():
                try:
                    with open(p, "r", encoding="utf-8-sig") as f:
                        return json.load(f)
                except Exception:
                    pass
        return None

    def list_scenarios(self) -> List[str]:
        try:
            r = httpx.get(f"{self.host}/scenarios", timeout=2.0)
            r.raise_for_status()
            return r.json().get("scenarios", [])
        except Exception:
            return ["INC-001", "INC-002", "INC-003", "INC-004"]
