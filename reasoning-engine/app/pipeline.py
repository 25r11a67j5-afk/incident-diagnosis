"""
Diagnosis Pipeline - orchestrates the full investigation flow.

Flow:
  1. Fetch scenario from simulation-engine (no ground truth)
  2. Correlate: ES logs + ES traces + Prometheus metrics + deployment metadata
  3. Build timeline
  4. Build structured evidence objects
  5. Investigator LLM pass -> hypotheses
  6. Verifier LLM pass -> verify top hypothesis + recommend action
  7. Deterministic safety override (schema migration blocks rollback)
  8. Assemble DiagnosisResponse

Ground truth is NEVER fetched or used here.
Cache is an explicit fallback - always audited in diagnosis_source field.
"""
from __future__ import annotations
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional, List

from groq import Groq

from app.clients.es_client import ESClient
from app.clients.prom_client import PromClient
from app.clients.simulation_client import SimulationClient, ExternalDependencyError
from app.core.correlation_engine import CorrelationEngine
from app.core.timeline_builder import build_timeline
from app.core.evidence_builder import build_evidence
from app.core.rollback_policy import RollbackPolicyEngine
from app.agents.investigator import run_investigator
from app.agents.verifier import run_verifier
from app.models.schemas import DiagnosisResponse

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

SCHEMA_MIGRATION_KEYWORDS = [
    "schema",
    "schema migration",
    "db migration",
    "database migration",
    "alter table",
    "not null",
    "add column",
    "drop column",
    "rename column",
    "table migration",
]


class DiagnosisPipeline:
    def __init__(self):
        self.es = ESClient()
        self.prom = PromClient()
        self.sim = SimulationClient()
        self.correlation = CorrelationEngine(self.es, self.prom)
        self.rollback_policy = RollbackPolicyEngine()

        groq_key = os.getenv("GROQ_API_KEY", "")
        self.groq = Groq(api_key=groq_key) if groq_key else None
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.fallback_model = os.getenv("GROQ_FALLBACK_MODEL", "llama-3.1-8b-instant")
        self.use_cache = os.getenv("USE_CACHE", "false").lower() == "true"

    async def run(self, scenario_id: str, force_live: bool = False) -> DiagnosisResponse:
        """Full diagnosis pipeline."""
        start_ms = int(time.time() * 1000)

        # ── 1. Cache check ────────────────────────────────────────────────
        if self.use_cache and not force_live:
            cached = self._load_cache(scenario_id)
            if cached:
                cached["diagnosis_source"] = "cached_fallback"
                return DiagnosisResponse(**cached)

        # ── 2. Step 1: Fetch scenario (no ground truth) ───────────────────
        # When force_live is True, do not fall back to mock scenario if Sim API is offline
        allow_mock = not force_live
        scenario = self.sim.get_scenario(scenario_id, allow_mock_fallback=allow_mock)
        scenario.pop("ground_truth", None)

        is_mock_fallback = bool(scenario.get("_is_mock_fallback", False))

        # ── 3. Step 2: Correlate observability data ───────────────────────
        correlated = self.correlation.correlate(scenario)

        # ── 4. Step 3: Build deterministic timeline ───────────────────────
        timeline = build_timeline(correlated)

        # ── 5. Step 4: Build first-class evidence objects ─────────────────
        evidence = build_evidence(correlated)

        # Record data sources actually queried (honest attribution)
        if is_mock_fallback:
            data_sources = ["mock_scenario_data", "deployment_metadata"]
        else:
            data_sources = []
            source_origins = correlated.get("source_origins", {})
            if source_origins.get("es_live"):
                data_sources.extend(["elasticsearch_logs", "elasticsearch_traces"])
            if source_origins.get("prom_live"):
                data_sources.append("prometheus")
            if correlated.get("deployments"):
                data_sources.append("deployment_metadata")
            if not data_sources:
                data_sources = ["deployment_metadata"]

        # ── 6. Step 5: Investigator LLM pass ──────────────────────────────
        if not self.groq:
            raise RuntimeError("GROQ_API_KEY not configured. Set it in .env")

        try:
            investigation = run_investigator(timeline, evidence, correlated, self.groq, self.model)
        except Exception:
            investigation = run_investigator(timeline, evidence, correlated, self.groq, self.fallback_model)

        hypotheses = investigation.get("hypotheses", [])
        evidence_sufficient = investigation.get("evidence_sufficient", True)
        missing_evidence = investigation.get("missing_evidence", None)

        # ── 7. Step 6: Verifier LLM pass ──────────────────────────────────
        verifier_result: Dict[str, Any] = {}
        recommended_action: Dict[str, Any] = {}
        permanent_suggestion: Optional[str] = None

        if evidence_sufficient and hypotheses:
            primary_id = investigation.get("primary_hypothesis_id", hypotheses[0]["id"])
            top_hypothesis = next((h for h in hypotheses if h["id"] == primary_id), hypotheses[0])

            supporting_evidence = [
                e for e in evidence if e["id"] in top_hypothesis.get("evidence_ids", [])
            ]
            if not supporting_evidence:
                supporting_evidence = evidence[:5]

            try:
                verifier_result = run_verifier(top_hypothesis, supporting_evidence, correlated, self.groq, self.model)
            except Exception:
                verifier_result = run_verifier(top_hypothesis, supporting_evidence, correlated, self.groq, self.fallback_model)

            recommended_action = verifier_result.get("recommended_action", {})
            permanent_suggestion = verifier_result.get("permanent_remediation_suggestion")
        else:
            recommended_action = {
                "type": "investigate_further",
                "category": "immediate_mitigation",
                "target_service": scenario.get("services", ["unknown"])[0],
                "target_version": None,
                "reasoning": f"Evidence insufficient to form a confident hypothesis. {missing_evidence or ''}",
                "is_reversible": True,
                "expected_recovery": "Gather additional diagnostic data before taking action",
            }

        # ── 8. Step 7: Deterministic Safety Override (Scenario 2 / INC-002) ──
        # CRITICAL PRD requirement: if deployment contains schema migration,
        # rollback MUST NOT be recommended. Implemented as deterministic safety override.
        migration_detected = False
        for dep in scenario.get("deployments", []):
            changes_text = ""
            if "changes_summary" in dep:
                changes_text += " " + str(dep["changes_summary"])
            if "changes" in dep:
                if isinstance(dep["changes"], list):
                    changes_text += " " + " ".join(dep["changes"])
                else:
                    changes_text += " " + str(dep["changes"])
            changes_text = changes_text.lower()

            if any(kw in changes_text for kw in SCHEMA_MIGRATION_KEYWORDS):
                migration_detected = True
                break

        db_state = scenario.get("database_state", {})
        if db_state and (db_state.get("backward_compatible") is False or db_state.get("migration_status") in ("applied", "running")):
            migration_detected = True

        policy_eval = self.rollback_policy.evaluate(scenario, recommended_action)

        if migration_detected:
            override_tag = " [DETERMINISTIC SAFETY OVERRIDE: schema/database migration detected; rollback is unsafe.]"
            if recommended_action.get("type") == "rollback":
                recommended_action["type"] = "degraded_mode"
                recommended_action["category"] = "immediate_mitigation"
                recommended_action["is_reversible"] = True
                if not recommended_action.get("expected_recovery"):
                    recommended_action["expected_recovery"] = (
                        "Operate in degraded mode while deploying backward-compatible schema fix."
                    )
            reasoning = recommended_action.get("reasoning", "")
            if override_tag not in reasoning:
                recommended_action["reasoning"] = (reasoning + override_tag).strip()
        elif not policy_eval.get("eligible", True) and recommended_action.get("type") == "rollback":
            recommended_action["type"] = "degraded_mode"
            recommended_action["category"] = "immediate_mitigation"
            recommended_action["is_reversible"] = True
            reasoning = recommended_action.get("reasoning", "")
            override_msg = f" [DETERMINISTIC SAFETY OVERRIDE: {policy_eval.get('blocking_reason', 'Rollback ineligible')}]"
            if override_msg not in reasoning:
                recommended_action["reasoning"] = (reasoning + override_msg).strip()

        # ── 9. Step 8: Link evidence to hypotheses ─────────────────────────
        hyp_index = {h["id"]: h for h in hypotheses}
        for ev in evidence:
            for hyp_id in ev.get("supports_hypotheses", []):
                if hyp_id in hyp_index:
                    if ev["id"] not in hyp_index[hyp_id]["evidence_ids"]:
                        hyp_index[hyp_id]["evidence_ids"].append(ev["id"])

        elapsed_ms = int(time.time() * 1000) - start_ms

        diagnosis_source = "mock_fallback" if is_mock_fallback else "live_llm"

        response_data = {
            "incident_id": scenario["incident_id"],
            "diagnosis_source": diagnosis_source,
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

        # Cache valid response
        self._save_cache(scenario_id, response_data)

        return DiagnosisResponse(**response_data)

    def _cache_path(self, scenario_id: str) -> Path:
        return CACHE_DIR / f"{scenario_id.upper()}.json"

    def _load_cache(self, scenario_id: str) -> Optional[Dict]:
        path = self._cache_path(scenario_id)
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return None

    def _save_cache(self, scenario_id: str, data: Dict):
        self._cache_path(scenario_id).write_text(json.dumps(data, indent=2), encoding="utf-8")

    def list_cache(self) -> Dict:
        return {
            "cached": [f.stem for f in CACHE_DIR.glob("*.json")],
            "use_cache_mode": self.use_cache,
        }

    def clear_cache(self, scenario_id: str):
        path = self._cache_path(scenario_id)
        if path.exists():
            path.unlink()
