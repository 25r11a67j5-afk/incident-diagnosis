/**
 * riskEngine.js
 * -------------
 * Deterministic, LLM-free risk calculation.
 *
 * Rule table (from PRD):
 *   rollback            impact=0.3, reversibility=1.0, blast_radius=0.2
 *   circuit_breaker     impact=0.2, reversibility=1.0, blast_radius=0.1
 *   scale               impact=0.1, reversibility=1.0, blast_radius=0.1
 *   config_change       impact=0.4, reversibility=0.8, blast_radius=0.3
 *   degraded_mode       impact=0.3, reversibility=0.9, blast_radius=0.2
 *   investigate_further impact=0,   reversibility=1.0, blast_radius=0.0
 *
 * Score formula (PRD):
 *   adjustedReversibility = reversibility * (rollback_safe ? 1 : 0.5)
 *   score = (impact + (1 - adjustedReversibility) + blast_radius) / 3
 *
 * Classification:
 *   score < 0.35  → LOW
 *   score < 0.60  → MEDIUM
 *   score >= 0.60 → HIGH
 */

const ACTION_TABLE = {
  rollback:            { impact: 0.3, reversibility: 1.0, blast_radius: 0.2 },
  circuit_breaker:     { impact: 0.2, reversibility: 1.0, blast_radius: 0.1 },
  scale:               { impact: 0.1, reversibility: 1.0, blast_radius: 0.1 },
  config_change:       { impact: 0.4, reversibility: 0.8, blast_radius: 0.3 },
  degraded_mode:       { impact: 0.3, reversibility: 0.9, blast_radius: 0.2 },
  investigate_further: { impact: 0.0, reversibility: 1.0, blast_radius: 0.0 },
};

/**
 * Compute a deterministic risk score for a given action type.
 *
 * @param {string} actionType      - one of the keys in ACTION_TABLE
 * @param {boolean} rollbackSafe   - from policy.rollback_safe
 * @returns {{ score: number, level: string, breakdown: object }}
 */
export function computeRisk(actionType, rollbackSafe = true) {
  const rule = ACTION_TABLE[actionType] ?? ACTION_TABLE.investigate_further;

  const adjustedReversibility = rule.reversibility * (rollbackSafe ? 1.0 : 0.5);
  const score = (rule.impact + (1 - adjustedReversibility) + rule.blast_radius) / 3;
  const roundedScore = Math.round(score * 1000) / 1000;

  let level;
  if (roundedScore < 0.35) level = "LOW";
  else if (roundedScore < 0.60) level = "MEDIUM";
  else level = "HIGH";

  return {
    score: roundedScore,
    level,
    breakdown: {
      impact: rule.impact,
      reversibility: rule.reversibility,
      adjustedReversibility: Math.round(adjustedReversibility * 1000) / 1000,
      blast_radius: rule.blast_radius,
      rollbackSafe,
    },
  };
}

/**
 * Simple rules baseline function (for Evaluation panel).
 * Rule: if a deployment event happened recently → recommend rollback.
 *
 * This intentionally produces "rollback" for both scenarios,
 * demonstrating that the deterministic policy (rollback_safe check)
 * correctly blocks the unsafe action in Scenario 2.
 *
 * @param {object} scenario - mock scenario object
 * @returns {string} recommended action type
 */
export function rulesBaseline(scenario) {
  const hasDeployment = scenario?.timeline?.some(
    (e) => e.event_type === "deployment" || e.event_type === "schema_migration"
  );
  return hasDeployment ? "rollback" : "investigate_further";
}

export { ACTION_TABLE };
