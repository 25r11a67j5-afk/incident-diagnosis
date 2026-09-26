"""
Diagnosis Pipeline — orchestrates the full investigation flow.

Flow:
  1. Fetch scenario from simulation-engine (no ground truth)
  2. Correlate: ES logs + ES traces + Prometheus metrics + deployment metadata
  3. Build timeline
  4. Build structured evidence objects
  5. Investigator LLM pass → hypotheses
  6. Verifier LLM pass → verify top hypothesis + recommend action
  7. Assemble DiagnosisResponse

Ground truth is NEVER fetched or used here.
Cache is an explicit fallback — always audited in diagnosis_source field.
"""
from __future__ import annotations
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

from groq import Groq

from app.clients.es_client import ESClient
from app.clients.prom_client import PromClient
from app.clients.simulation_client import SimulationClient
from app.core.correlation_engine import CorrelationEngine
from app.core.timeline_builder import build_timeline
from app.core.evidence_builder import build_evidence
from app.agents.investigator import run_investigator
from app.agents.verifier import run_verifier
from app.models.schemas import DiagnosisResponse

CACHE_DIR = Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)


class DiagnosisPipeline:
    def __init__(self):
        self.es = ESClient()
        self.prom = PromClient()
        self.sim = SimulationClient()
        self.correlation = CorrelationEngine(self.es, self.prom)

        groq_key = os.getenv("GROQ_API_KEY", "")
        self.groq = Groq(api_key=groq_key) if groq_key else None
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.fallback_model = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")
        self.use_cache = os.getenv("USE_CACHE", "false").lower() == "true"

    async def run(self, scenario_id: str, force_live: bool = False) -> DiagnosisResponse:
        """Full diagnosis pipeline."""
        start_ms = int(time.time() * 1000)

        # ── Cache check ───────────────────────────────────────────
        if self.use_cache and not force_live:
            cached = self._load_cache(scenario_id)
            if cached:
                cached["diagnosis_source"] = "cached_fallback"
                return DiagnosisResponse(**cached)

        # ── Step 1: Fetch scenario (no ground truth) ──────────────
        scenario = self.sim.get_scenario(scenario_id)

        # ── Step 2: Correlate from ES + Prometheus ────────────────
        correlated = self.correlation.correlate(scenario)

        # ── Step 3: Build timeline ────────────────────────────────
        timeline = build_timeline(correlated)

        # ── Step 4: Build evidence objects ────────────────────────
        evidence = build_evidence(correlated)

        data_sources = _detect_sources(correlated)

        # ── Step 5: Investigator LLM pass ─────────────────────────
        if not self.groq:
            raise RuntimeError("GROQ_API_KEY not configured. Set it in .env")

        try:
            investigation = run_investigator(timeline, evidence, correlated, self.groq, self.model)
        except Exception:
            # Fallback to smaller model
            investigation = run_investigator(timeline, evidence, correlated, self.groq, self.fallback_model)

        hypotheses = investigation.get("hypotheses", [])
        evidence_sufficient = investigation.get("evidence_sufficient", True)
        missing_evidence = investigation.get("missing_evidence", None)

        # ── Step 6: Verifier LLM pass ─────────────────────────────
        verifier_result: Dict[str, Any] = {}
        recommended_action: Dict[str, Any] = {}
        permanent_suggestion: Optional[str] = None

        if evidence_sufficient and hypotheses:
            primary_id = investigation.get("primary_hypothesis_id", hypotheses[0]["id"])
            top_hypothesis = next((h for h in hypotheses if h["id"] == primary_id), hypotheses[0])

            # Only pass evidence that supports the top hypothesis
            supporting_evidence = [
                e for e in evidence if e["id"] in top_hypothesis.get("evidence_ids", [])
            ]

            try:
                verifier_result = run_verifier(top_hypothesis, supporting_evidence, correlated, self.groq, self.model)
            except Exception:
                verifier_result = run_verifier(top_hypothesis, supporting_evidence, correlated, self.groq, self.fallback_model)

            recommended_action = verifier_result.get("recommended_action", {})
            permanent_suggestion = verifier_result.get("permanent_remediation_suggestion")
        else:
            # Insufficient evidence — default to investigate_further
            recommended_action = {
                "type": "investigate_further",
                "category": "immediate_mitigation",
                "target_service": scenario.get("services", ["unknown"])[0],
                "target_version": None,
                "reasoning": f"Evidence insufficient to form a confident hypothesis. {missing_evidence or ''}",
                "is_reversible": True,
                "expected_recovery": "Gather additional diagnostic data before taking action",
            }

        # ── Step 7: Link evidence to hypotheses ───────────────────
        hyp_index = {h["id"]: h for h in hypotheses}
        for ev in evidence:
            for hyp_id in ev.get("supports_hypotheses", []):
                if hyp_id in hyp_index:
                    if ev["id"] not in hyp_index[hyp_id]["evidence_ids"]:
                        hyp_index[hyp_id]["evidence_ids"].append(ev["id"])

        elapsed_ms = int(time.time() * 1000) - start_ms

        # ── Assemble response ─────────────────────────────────────
        response_data = {
            "incident_id": scenario["incident_id"],
            "diagnosis_source": "live_llm",
            "diagnosis_time_ms": elapsed_ms,
            "data_sources_queried": data_sources,
            "timeline": timeline,
            "evidence": evidence,
            "hypotheses": hypotheses,
            "recommended_action": recommended_action,
            "permanent_remediation_suggestion": permanent_suggestion,
            "evidence_sufficient": evidence_sufficient,
            "missing_evidence": missing_evidence,
        }

        # ── Save to cache (demo insurance) ────────────────────────
        self._save_cache(scenario_id, response_data)

        return DiagnosisResponse(**response_data)

    # ── Cache helpers ─────────────────────────────────────────────
    def _cache_path(self, scenario_id: str) -> Path:
        return CACHE_DIR / f"{scenario_id.upper()}.json"

    def _load_cache(self, scenario_id: str) -> Optional[Dict]:
        path = self._cache_path(scenario_id)
        if path.exists():
            return json.loads(path.read_text())
        return None

    def _save_cache(self, scenario_id: str, data: Dict):
        self._cache_path(scenario_id).write_text(json.dumps(data, indent=2))

    def list_cache(self) -> Dict:
        return {
            "cached": [f.stem for f in CACHE_DIR.glob("*.json")],
            "use_cache_mode": self.use_cache,
        }

    def clear_cache(self, scenario_id: str):
        path = self._cache_path(scenario_id)
        if path.exists():
            path.unlink()


def _detect_sources(correlated: Dict[str, Any]) -> list:
    sources = []
    if correlated.get("logs") or correlated.get("error_logs"):
        sources.append("elasticsearch_logs")
    if correlated.get("traces"):
        sources.append("elasticsearch_traces")
    if any(v for v in correlated.get("metrics", {}).values()):
        sources.append("prometheus")
    if correlated.get("deployments"):
        sources.append("deployment_metadata")
    return sources
