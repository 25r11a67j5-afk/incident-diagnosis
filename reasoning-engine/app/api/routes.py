"""
API Routes - Reasoning Engine
Person 2 owns this.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app.models.schemas import DiagnoseRequest, DiagnosisResponse
from app.pipeline import DiagnosisPipeline
from app.clients.simulation_client import ExternalDependencyError

router = APIRouter()
_pipeline = DiagnosisPipeline()


@router.post("/diagnose", response_model=DiagnosisResponse)
async def diagnose(req: DiagnoseRequest):
    """
    Main endpoint - runs full diagnosis pipeline.
    Person 3 calls this with { "scenario_id": "INC-001" }.
    diagnosis_source will be "live_llm", "cached_fallback", or "mock_fallback".
    """
    try:
        return await _pipeline.run(req.scenario_id, force_live=req.force_live)
    except ExternalDependencyError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "external_dependency_unavailable",
                "message": str(e),
                "hint": "Person 1 infrastructure is currently offline. Set force_live: false to demonstrate the reasoning pipeline with local mock fallback.",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache")
def list_cache():
    return _pipeline.list_cache()


@router.delete("/cache/{scenario_id}")
def clear_cache(scenario_id: str):
    _pipeline.clear_cache(scenario_id)
    return {"cleared": scenario_id}
