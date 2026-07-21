"""Immutable records of significant system activity.

WP-A slice A1 implemented: the AuditEvent model and
audit.service.record_audit_event, called internally by
intent.core_anchor_service and intent.brief_service. No HTTP endpoints
exist in this module yet -- the read/query surface (`GET /audit/events`)
is deferred to slice A4. Scope: docs/ARCHITECTURE.md §4,
docs/DOMAIN_MODEL.md §9 (`AuditEvent`).
"""
