"""
Verifier Agent - Pass 2 of 2 (Multi-agent bonus)
Receives the top hypothesis + evidence and independently verifies it.
Also recommends the remediation action, separating mitigation from remediation.
"""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List
from groq import Groq
from app.agents.groq_client import call_groq_json

logger = logging.getLogger(__name__)

VERIFIER_SCHEMA = """{
  "hypothesis_verified": true,
  "verification_confidence": 0.0,
  "verification_notes": "string",
  "recommended_action": {
    "type": "rollback|circuit_breaker|scale|config_change|degraded_mode|investigate_further",
    "category": "immediate_mitigation|permanent_remediation",
    "target_service": "string",
    "target_version": "string or null",
    "reasoning": "string",
    "is_reversible": true,
    "expected_recovery": "string"
  },
  "permanent_remediation_suggestion": "string or null"
}"""


def run_verifier(
    top_hypothesis: Dict[str, Any],
    supporting_evidence: List[Dict],
    correlated: Dict[str, Any],
    client: Groq,
    model: str,
) -> Dict[str, Any]:
    prompt = f"""You are a senior SRE verifying an incident hypothesis and recommending an action.

TOP HYPOTHESIS TO VERIFY:
{json.dumps(top_hypothesis, indent=2)}

SUPPORTING EVIDENCE:
{json.dumps(supporting_evidence, indent=2)}

KNOWN GOOD VERSIONS:
{json.dumps(correlated.get("known_good_versions", {}), indent=2)}

DATABASE STATE (if any):
{json.dumps(correlated.get("database_state"), indent=2)}

EXTERNAL DEPENDENCIES:
{json.dumps(correlated.get("external_dependencies", []), indent=2)}

TASK (Verifier Pass):
1. Verify whether the evidence genuinely supports the top hypothesis.
2. Recommend ONE immediate action to reduce damage:
   - rollback: only if a deployment caused the issue AND no schema migration is involved
   - circuit_breaker: if a dependency/external service is failing
   - degraded_mode: if rollback is structurally risky (e.g. schema migration present)
   - scale: if resource exhaustion is the cause
   - investigate_further: if evidence is insufficient

3. Separately suggest what the permanent remediation should be (fix the root cause, not just symptoms).

IMPORTANT: If the deployment changes include a database schema migration, recommend degraded_mode
or investigate_further - NOT rollback. The policy engine will enforce this, but your recommendation
should already reflect this analysis.

Respond with ONLY valid JSON matching:
{VERIFIER_SCHEMA}"""

    messages = [
        {"role": "system", "content": "You are a senior SRE. Respond with ONLY valid JSON matching the exact schema."},
        {"role": "user", "content": prompt},
    ]

    data = call_groq_json(client=client, messages=messages, preferred_model=model, max_tokens=2500)

    if "recommended_action" not in data or not isinstance(data["recommended_action"], dict):
        data["recommended_action"] = {
            "type": "investigate_further",
            "category": "immediate_mitigation",
            "target_service": top_hypothesis.get("service", "unknown"),
            "target_version": None,
            "reasoning": "Incomplete verifier response.",
            "is_reversible": True,
            "expected_recovery": None,
        }

    return data
