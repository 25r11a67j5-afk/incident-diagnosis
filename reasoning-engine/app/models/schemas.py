"""
Pydantic models for all inter-service contracts.
These match CONTRACTS.md exactly.
"""
from __future__ import annotations
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ── Evidence (first-class structured object) ─────────────────────
class Evidence(BaseModel):
    id: str
    source: str          # elasticsearch_logs | elasticsearch_traces | prometheus | deployment_metadata
    type: str            # metric_anomaly | log_pattern | trace_correlation | temporal_correlation | baseline_comparison
    service: str
    timestamp: str
    observation: str
    query_used: Optional[str] = None
    raw_value: Optional[float] = None
    baseline_value: Optional[float] = None
    deviation_factor: Optional[float] = None
    supports_hypotheses: List[str] = Field(default_factory=list)
    contradicts_hypotheses: List[str] = Field(default_factory=list)
    weight: float        # 0.0 to 1.0


# ── Hypothesis ───────────────────────────────────────────────────
class Hypothesis(BaseModel):
    id: str
    cause: str
    confidence: float    # 0.0 to 1.0
    evidence_ids: List[str]


# ── Timeline event ───────────────────────────────────────────────
class TimelineEvent(BaseModel):
    timestamp: str
    service: str
    summary: str
    event_type: str      # deployment | log_error | log_warn | metric_anomaly | trace_anomaly | incident_declared
    source: str          # elasticsearch_logs | prometheus | deployment_metadata | elasticsearch_traces


# ── Recommended action ───────────────────────────────────────────
class RecommendedAction(BaseModel):
    type: str            # rollback | circuit_breaker | scale | config_change | degraded_mode | investigate_further
    category: str        # immediate_mitigation | permanent_remediation
    target_service: str
    target_version: Optional[str] = None
    reasoning: str
    is_reversible: bool
    expected_recovery: Optional[str] = None


# ── Full diagnosis response ───────────────────────────────────────
class DiagnosisResponse(BaseModel):
    incident_id: str
    diagnosis_source: str   # live_llm | cached_fallback
    diagnosis_time_ms: int
    data_sources_queried: List[str]
    timeline: List[TimelineEvent]
    evidence: List[Evidence]
    hypotheses: List[Hypothesis]
    recommended_action: RecommendedAction
    permanent_remediation_suggestion: Optional[str] = None
    evidence_sufficient: bool
    missing_evidence: Optional[str] = None


# ── Diagnose request ─────────────────────────────────────────────
class DiagnoseRequest(BaseModel):
    scenario_id: str
    force_live: bool = False   # bypass cache even if USE_CACHE=true
