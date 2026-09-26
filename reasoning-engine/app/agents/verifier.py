"""
Verifier Agent — Pass 2 of 2 (Multi-agent bonus)
Receives the top hypothesis + evidence and independently verifies it.
Also recommends the remediation action, separating mitigation from remediation.
"""
from __future__ import annotations
import json, re
from typing import Any, Dict, List

from groq import Groq

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
    """
    Pass 2: Verify the top hypothesis and recommend the safest action.

    CRITICAL INSTRUCTION to LLM: The verifier must NOT factor in ground truth.
    It reasons from the evidence about whether rollback is structurally safe.
    The policy engine will make the final rollback eligibility decision.
    """
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
or investigate_further — NOT rollback. The policy engine will enforce this, but your recommendation
should already reflect this analysis.

Respond with ONLY valid JSON matching:
{VERIFIER_SCHEMA}"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a senior SRE. Respond with ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=1200,
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
