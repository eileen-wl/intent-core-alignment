"""Permissions, Human Gates, Decisions, valid transitions, escalation.

WP-A slice A1 implemented: ActorContext and its permission guards
(workflow.actors), minimal Decision persistence (workflow.decision_service)
and WorkflowTransition persistence (workflow.transition_service). No HTTP
endpoints exist in this module yet -- Decision/WorkflowTransition rows are
written internally as a side effect of intent.core_anchor_service actions
only. HumanGate and the gate/decision read-query surface are not yet
implemented (deferred to A3/A4, see apps/api/src/intent_core_api/intent/README.md).
Scope: docs/ARCHITECTURE.md §4, §7, docs/ROLE_PERMISSIONS.md. Role
permissions and workflow states are change-boundary items per CLAUDE.md;
permission checks are deterministic backend logic (workflow.actors guard
functions), not prompts.
"""
