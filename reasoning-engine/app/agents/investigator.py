"""
Investigator Agent — Pass 1 of 2 (Multi-agent bonus)
Receives correlated data + evidence + timeline.
Produces ranked hypotheses with evidence links.
"""
from __future__ import annotations
import json, os, re
from typing import Any, Dict, List

from groq import Groq

INVESTIGATOR_SCHEMA = """{
  "hypotheses": [
    {
      "id": "H-001",
      "cause": "string — what went wrong",
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
    """
    Pass 1: Investigate the incident and form hypotheses.
    Returns raw parsed JSON from the LLM.
    """
    prompt = f"""You are an expert SRE investigating a production incident.

INCIDENT TIMELINE (chronological):
{json.dumps(timeline, indent=2)}

STRUCTURED EVIDENCE (from Elasticsearch + Prometheus + deployment metadata):
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

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert SRE. Respond with ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=1500,
    )
    return _parse_json(response.choices[0].message.content)


def _parse_json(raw: str) -> Dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*(.*?)```", raw, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end != -1:
            return json.loads(raw[start : end + 1])
        raise ValueError(f"Could not parse LLM JSON response: {raw[:200]}")
