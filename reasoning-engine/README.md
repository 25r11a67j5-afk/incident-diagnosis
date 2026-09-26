# Reasoning Engine — Person 2 (YOU)

**Port:** 5002  
**Stack:** Python · FastAPI · Elasticsearch · Prometheus · Groq LLM

## Quick Start

```bash
pip install -r requirements.txt
cp .env.example .env    # fill in GROQ_API_KEY
uvicorn app.main:app --reload --port 5002
```

## Architecture

```
POST /diagnose (scenario_id)
        │
        ├── 1. Fetch scenario from simulation-engine :5001
        │
        ├── 2. Correlation Engine
        │       ├── Query ES logs (logs-{incident_id})
        │       ├── Query ES traces (traces-{incident_id})
        │       ├── Query Prometheus (error_rate, latency, CPU)
        │       └── Merge deployment metadata
        │
        ├── 3. Timeline Builder
        │       └── Chronological stream: deployments + errors + anomalies
        │
        ├── 4. Evidence Builder
        │       └── Structured evidence objects (source, type, weight)
        │
        ├── 5. Groq LLM — Investigator pass
        │       └── Hypotheses ranked by confidence
        │
        ├── 6. Groq LLM — Verifier pass (bonus)
        │       └── Verify top hypothesis against evidence
        │
        └── 7. Remediation Planner
                └── immediate_mitigation + permanent_remediation
```

## API

| Method | Path | Description |
|---|---|---|
| POST | /diagnose | Full diagnosis pipeline |
| GET | /health | Health + data source status |
| GET | /cache | List cached responses |

## Cache Mode

Set `USE_CACHE=true` in `.env` to replay cached responses (demo fallback).
Cache is stored in `cache/{scenario_id}.json`.
`diagnosis_source` field in response shows `live_llm` vs `cached_fallback`.
