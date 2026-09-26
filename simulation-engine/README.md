# Simulation Engine — Person 1

**Port:** 5001  
**Owns:** Docker Compose (ES + Prometheus + Grafana), simulated microservices, fault injection, scenario data, ground truth API.

## Quick Start

```bash
docker-compose up -d
python scripts/load_scenarios.py
# API available at http://localhost:5001
```

## API

| Method | Path | Description |
|---|---|---|
| GET | /scenarios | List all scenarios |
| GET | /scenarios/:id | Get observable scenario (no ground truth) |
| GET | /scenarios/:id/ground-truth | Ground truth (evaluation harness only) |
| POST | /scenarios/:id/inject | Trigger fault injection |
| GET | /health | Health check |
| GET | /metrics | Prometheus metrics endpoint |

## ES Indices

| Index | Content |
|---|---|
| `logs-{incident_id}` | Application logs |
| `traces-{incident_id}` | Distributed traces |
| `deployments-{incident_id}` | Deployment events |

## Scenarios

| ID | File | Root Cause |
|---|---|---|
| INC-001 | scenarios/observable/inc-001.json | Deployment regression (rollback safe) |
| INC-002 | scenarios/observable/inc-002.json | DB schema migration (rollback unsafe) |
| INC-003 | scenarios/observable/inc-003.json | Dependency cascade |
| INC-004 | scenarios/observable/inc-004.json | Insufficient evidence |
