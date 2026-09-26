"""
API Routes — Reasoning Engine
Person 2 owns this. Do not modify from other repos.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app.models.schemas import DiagnoseRequest, DiagnosisResponse
from app.pipeline import DiagnosisPipeline

router = APIRouter()
_pipeline = DiagnosisPipeline()   # singleton


@router.post("/diagnose", response_model=DiagnosisResponse)
async def diagnose(req: DiagnoseRequest):
    """
    Main endpoint — runs full diagnosis pipeline.
    Person 3 calls this with { "scenario_id": "INC-001" }.
    Returns DiagnosisResponse (see contracts/CONTRACTS.md §3.2).
    diagnosis_source will be "live_llm" or "cached_fallback".
    """
    try:
        return await _pipeline.run(req.scenario_id, force_live=req.force_live)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache")
def list_cache():
    """List cached scenario responses available for replay mode."""
    return _pipeline.list_cache()


@router.delete("/cache/{scenario_id}")
def clear_cache(scenario_id: str):
    """Clear a cached response to force fresh LLM call."""
    _pipeline.clear_cache(scenario_id)
    return {"cleared": scenario_id}
