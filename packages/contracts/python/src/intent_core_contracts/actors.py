"""Shared human-role vocabulary used by API schemas and by the backend's
temporary actor-identity dependency (see docs/ROLE_PERMISSIONS.md).

Only the human role vocabulary is shared here. The full actor concept
(which also models agent- and system-originated calls) is an internal
``apps/api`` value object per ADR-0008 ("SQLAlchemy models and business
logic stay inside apps/api only") and is intentionally not part of this
package.
"""

from __future__ import annotations

from typing import Literal

HumanRole = Literal["vfx_supervisor", "cg_supervisor", "artist"]
