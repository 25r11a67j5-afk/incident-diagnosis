"""
Investigator Agent - Pass 1 of 2 (Multi-agent bonus)
Receives correlated data + evidence + timeline.
Produces ranked hypotheses with evidence links.
"""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List
from groq import Groq
from app.agents.groq_client import call_groq_json

logger = logging.getLogger(__name__)

INVESTIGATOR_SCHEMA = """{
  "hypotheses": [
    {
      "id": "H-001",
      "cause": "string - what went wrong",
      "confidence": 0.0,
      "evidence_ids": ["E-001", "E-002"]
    }
  ],
  "primary_hypothesis_id": "H-001",
  "evidence_sufficient": true,
  "missing_evidence": null
}"""


def run_investigator(
    timeline: List[Dict],
    evidence: List[Dict],
    correlated: Dict[str, Any],
    client: Groq,
    model: str,
) -> Dict[str, Any]:
    prompt = f"""You are an expert SRE investigating a production incident.

INCIDENT TIMELINE (chronological):
{json.dumps(timeline, indent=2)}

STRUCTURED EVIDENCE (from observability data + deployment metadata):
{json.dumps(evidence, indent=2)}

DEPLOYMENT HISTORY:
{json.dumps(correlated.get("deployments", []), indent=2)}

KNOWN GOOD VERSIONS:
{json.dumps(correlated.get("known_good_versions", {}), indent=2)}

SERVICE DEPENDENCIES:
{json.dumps(correlated.get("service_dependencies", {}), indent=2)}

EXTERNAL DEPENDENCIES:
{json.dumps(correlated.get("external_dependencies", []), indent=2)}

DATABASE STATE:
{json.dumps(correlated.get("database_state"), indent=2)}

TASK (Investigator Pass):
Form hypotheses about the root cause. For EACH hypothesis:
- id: sequential (H-001, H-002, ...)
- cause: precise description of what went wrong
- confidence: 0.0 to 1.0 based on evidence strength
- evidence_ids: list of evidence IDs that support this hypothesis

If no single hypothesis reaches confidence > 0.4, set evidence_sufficient to false.
Specify what missing_evidence would help resolve the ambiguity.

Respond with ONLY valid JSON matching this schema:
{INVESTIGATOR_SCHEMA}"""

    messages = [
        {"role": "system", "content": "You are an expert SRE. Respond with ONLY valid JSON matching the exact schema."},
        {"role": "user", "content": prompt},
    ]

    data = call_groq_json(client=client, messages=messages, preferred_model=model, max_tokens=3000)

    if "hypotheses" not in data or not isinstance(data["hypotheses"], list):
        data["hypotheses"] = []
    if "evidence_sufficient" not in data:
        data["evidence_sufficient"] = len(data["hypotheses"]) > 0
    if "primary_hypothesis_id" not in data and data["hypotheses"]:
        data["primary_hypothesis_id"] = data["hypotheses"][0].get("id", "H-001")
    if "missing_evidence" not in data:
        data["missing_evidence"] = None

    return data
