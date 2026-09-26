"""
API Routes for the Reasoning Engine.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app.models.schemas import DiagnoseRequest, DiagnosisResponse
from app.pipeline import DiagnosisPipeline

router = APIRouter()
pipeline = DiagnosisPipeline()


@router.post("/diagnose", response_model=DiagnosisResponse)
async def diagnose(req: DiagnoseRequest):
    try:
        return await pipeline.run(req.scenario_id, force_live=req.force_live)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache")
def list_cache():
    return pipeline.list_cache()


@router.delete("/cache/{scenario_id}")
def clear_cache(scenario_id: str):
    pipeline.clear_cache(scenario_id)
    return {"cleared": scenario_id}
