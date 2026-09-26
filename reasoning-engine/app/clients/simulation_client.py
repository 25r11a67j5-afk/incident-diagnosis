"""
Simulation API client — fetches scenario observable data from Person 1 engine.
Ground truth endpoint is deliberately NOT called here.
"""
from __future__ import annotations
import os
from typing import Dict, Any
import httpx


class SimulationClient:
    def __init__(self, host: str = None):
        self.host = host or os.getenv("SIMULATION_API", "http://localhost:5001")

    def get_scenario(self, scenario_id: str) -> Dict[str, Any]:
        """Fetch observable scenario. Ground truth is excluded by the simulation engine."""
        r = httpx.get(f"{self.host}/scenarios/{scenario_id}", timeout=10)
        r.raise_for_status()
        return r.json()

    def list_scenarios(self) -> list:
        r = httpx.get(f"{self.host}/scenarios", timeout=5)
        r.raise_for_status()
        return r.json().get("scenarios", [])
