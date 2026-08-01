"""Import every SQLAlchemy model module so Base.metadata is complete.

Used by alembic/env.py (migrations) and test fixtures that need to
`Base.metadata.create_all`. Import this module for its side effects
only.
"""

from intent_core_api.agents import models as _agents_models  # noqa: F401
from intent_core_api.audit import models as _audit_models  # noqa: F401
from intent_core_api.cross_department import models as _cross_department_models  # noqa: F401
from intent_core_api.integrations import models as _integrations_models  # noqa: F401
from intent_core_api.intent import models as _intent_models  # noqa: F401
from intent_core_api.ops import models as _ops_models  # noqa: F401
from intent_core_api.production_context import models as _production_context_models  # noqa: F401
from intent_core_api.versions_and_feedback import (
    models as _versions_and_feedback_models,  # noqa: F401
)
from intent_core_api.workflow import models as _workflow_models  # noqa: F401
