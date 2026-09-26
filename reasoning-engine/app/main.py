"""
Reasoning Engine — FastAPI Application Entry Point
Person 2 owns this file. Do not modify from other repos.
"""
from __future__ import annotations
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.api.routes import router
from app.clients.es_client import ESClient
from app.clients.prom_client import PromClient
from app.clients.simulation_client import SimulationClient

app = FastAPI(
    title="Reasoning Engine",
    description="Agentic Incident Diagnosis — Correlation, Timeline, LLM Investigation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    """Health check — also reports data source connectivity."""
    es = ESClient()
    prom = PromClient()
    sim_host = os.getenv("SIMULATION_API", "http://localhost:5001")

    es_ok = es.is_healthy()
    prom_ok = prom.is_healthy()

    try:
        import httpx
        r = httpx.get(f"{sim_host}/health", timeout=2)
        sim_ok = r.status_code == 200
    except Exception:
        sim_ok = False

    return {
        "status": "ok",
        "service": "reasoning-engine",
        "port": 5002,
        "data_sources": {
            "elasticsearch": "✅ connected" if es_ok else "❌ not reachable",
            "prometheus":    "✅ connected" if prom_ok else "❌ not reachable",
            "simulation_api": "✅ connected" if sim_ok else "❌ not reachable",
        },
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "cache_mode": os.getenv("USE_CACHE", "false"),
    }
