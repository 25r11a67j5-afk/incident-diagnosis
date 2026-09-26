"""
Rollback Policy Engine — deterministic, no LLM.

Determines whether a rollback action is eligible based SOLELY on
observable deployment metadata. Does NOT use ground_truth.rollback_safe.

Decision logic:
  1. Is there a known-good version to roll back to?
  2. Does the deployment contain a database schema migration?
  3. Is the database schema forward-only (backward_compatible=false)?
  4. Are there active background jobs tied to the migration?
  5. Would v_previous be compatible with the current database state?
"""
from __future__ import annotations
from typing import Any, Dict


SCHEMA_MIGRATION_KEYWORDS = [
    "schema migration", "db migration", "database migration",
    "alter table", "not null", "add column", "drop column",
    "create table", "rename column", "data migration",
]


class RollbackPolicyEngine:

    def evaluate(self, scenario: Dict[str, Any], recommended_action: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns:
          { eligible: bool, checks: {...}, blocking_reason: str | None }
        """
        if recommended_action.get("type") != "rollback":
            return {
                "eligible": False,
                "checks": {},
                "blocking_reason": "Recommended action is not a rollback",
            }

        target_service = recommended_action.get("target_service", "")
        deployments = scenario.get("deployments", [])
        known_good = scenario.get("known_good_versions", {})
        db_state = scenario.get("database_state", None)

        checks: Dict[str, bool] = {}

        # ── Check 1: known-good version exists ────────────────────
        checks["known_good_version_exists"] = target_service in known_good

        # ── Check 2: schema migration in deployment ───────────────
        schema_migration_detected = False
        for dep in deployments:
            if dep.get("service") != target_service:
                continue
            changes_text = " ".join(dep.get("changes", [])).lower()
            if any(kw in changes_text for kw in SCHEMA_MIGRATION_KEYWORDS):
                schema_migration_detected = True
                break
        checks["schema_migration_detected"] = schema_migration_detected

        # ── Check 3: database backward compatibility ───────────────
        db_backward_compat = True
        if db_state:
            db_backward_compat = db_state.get("backward_compatible", True)
        checks["database_backward_compatible"] = db_backward_compat

        # ── Check 4: active migration running ─────────────────────
        active_migration = False
        if db_state and db_state.get("migration_status") == "running":
            active_migration = True
        checks["active_migration_running"] = active_migration

        # ── Policy decision ───────────────────────────────────────
        if not checks["known_good_version_exists"]:
            return {
                "eligible": False,
                "checks": checks,
                "blocking_reason": f"No known-good version found for {target_service}",
            }

        if checks["schema_migration_detected"] and not checks["database_backward_compatible"]:
            return {
                "eligible": False,
                "checks": checks,
                "blocking_reason": (
                    "Schema migration detected and database is NOT backward compatible. "
                    "Rolling back the application while the new schema is live will cause "
                    "data integrity violations. Rollback blocked."
                ),
            }

        if checks["active_migration_running"]:
            return {
                "eligible": False,
                "checks": checks,
                "blocking_reason": "Active database migration in progress. Rollback blocked until migration completes or is rolled back separately.",
            }

        return {
            "eligible": True,
            "checks": checks,
            "blocking_reason": None,
        }
