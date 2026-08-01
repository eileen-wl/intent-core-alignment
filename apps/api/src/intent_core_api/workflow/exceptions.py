"""Domain exceptions raised by service-layer permission and state checks.

Routers do not catch these individually: ``main.py`` registers FastAPI
exception handlers that map each type to its HTTP status code (403/409/404),
so routers stay thin and services stay the single source of truth for
whether an action is allowed (CLAUDE.md: "Permissions must be enforced in
backend logic, not only in prompts or UI").
"""

from __future__ import annotations


class ForbiddenActionError(Exception):
    """The acting ActorContext is not permitted to perform this action."""


class ConflictError(Exception):
    """A business-rule state conflict or a concurrency conflict prevented the action."""


class NotFoundError(Exception):
    """A referenced entity does not exist."""


class ValidationError(Exception):
    """The request's own content fails a domain content-validation rule --
    distinct from ConflictError (a state/concurrency conflict) and
    ForbiddenActionError (a permission rejection): this is a rejection of
    the content itself, e.g. confirming a revision with no substantive
    content in any field.
    """


class AgentGenerationError(Exception):
    """An Agent's model/provider call failed, or no working provider is
    configured. Distinct from ConflictError/ForbiddenActionError: this is
    an upstream dependency failure, not a business-rule or permission
    rejection.
    """


class InternalConsistencyError(Exception):
    """A data-integrity invariant that should be unreachable was violated
    (e.g. a stored pointer references a row belonging to a different
    parent entity than expected).

    This is deliberately NOT registered with a FastAPI exception handler
    and must never be mapped to a user-facing 4xx response: it indicates
    a bug or data corruption, not an invalid request. Left unhandled, it
    surfaces as an unhandled exception (framework default 500), which does
    not expose this message or any internal detail to the client.
    """
