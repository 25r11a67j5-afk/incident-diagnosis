# 🚨 Agentic Incident Diagnosis & Remediation

> Agentic AI that investigates simulated production incidents using Elasticsearch, Prometheus, and Groq LLM — with human-in-the-loop approval, sandboxed execution, and full audit trails.

## Core Architectural Principles

1. **Ground truth never leaks into the diagnosis or execution path.** Evaluation harness only.
2. **Rollback safety is determined by the policy engine from deployment metadata** — not a flag.
3. **Traces are first-class telemetry** alongside logs and metrics (separate ES index: `traces-*`).
4. **Evidence is a structured object** with source, type, weight, and hypothesis links.
5. **The sandbox executes independently** — measures health before/after, does not know expected answer.
6. **Cache is an explicit fallback mode** — audited and shown in the UI as REPLAY MODE.
7. **LLM recommends. Policy engine decides. Human approves.**

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│  SIMULATION ENGINE  (Person 1)  :5001                    │
│  Docker Compose · ES · Prometheus · Grafana              │
│  Simulated services · Fault injection · Scenario data    │
│                                                          │
│  ES indices:                                             │
│    logs-{incident_id}      ← application logs            │
│    traces-{incident_id}    ← distributed traces          │
│    deployments-{incident_id} ← deployment events        │
└─────────────────────┬────────────────────────────────────┘
                      │ real ES + Prometheus data
                      ▼
┌──────────────────────────────────────────────────────────┐
│  REASONING ENGINE  (Person 2)  :5002                     │
│  ES client · Prometheus client                           │
│  Correlation engine · Timeline builder                   │
│  Evidence objects (structured, sourced, weighted)        │
│  Groq LLM (Investigator → Verifier two-pass)             │
│  Hypothesis ranker · Remediation planner                 │
│  POST /diagnose → DiagnosisResponse                      │
└─────────────────────┬────────────────────────────────────┘
                      │ structured DiagnosisResponse
                      ▼
┌──────────────────────────────────────────────────────────┐
│  CONTROL PLANE  (Person 3)  :3000                        │
│  React dashboard                                         │
│  Deterministic risk engine (NO LLM)                      │
│  Rollback policy engine (from deployment metadata)       │
│  Approval gate (Approve / Reject / Investigate)          │
│  Sandbox simulator (health before → action → after)      │
│  Append-only audit log                                   │
│  Evaluation harness (uses ground_truth, isolated)        │
└──────────────────────────────────────────────────────────┘
```

## Repos

| Repo | Owner | Port |
|---|---|---|
| `simulation-engine/` | Person 1 (fixed) | 5001 |
| `reasoning-engine/` | Person 2 | 5002 |
| `control-plane/` | Person 3 | 3000 |

## Ports

```
Elasticsearch:   localhost:9200
Prometheus:      localhost:9090
Grafana:         localhost:3001
Simulation API:  localhost:5001
Reasoning API:   localhost:5002
Control Plane:   localhost:3000
```

## Scenarios

| ID | Name | Correct Action | Rollback Safe |
|---|---|---|---|
| INC-001 | Deployment Regression | rollback | ✅ |
| INC-002 | DB Schema Migration | degraded_mode | ❌ |
| INC-003 | Dependency Cascade | circuit_breaker | ❌ |
| INC-004 | Insufficient Evidence | investigate_further | — |

## Quick Start

```bash
# 1. Infrastructure (Person 1)
cd simulation-engine && docker-compose up -d

# 2. Reasoning Engine (Person 2)
cd reasoning-engine
pip install -r requirements.txt
cp .env.example .env   # add GROQ_API_KEY
uvicorn app.main:app --reload --port 5002

# 3. Control Plane (Person 3)
cd control-plane && npm install && npm run dev
```
