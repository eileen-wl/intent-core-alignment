"""Import every SQLAlchemy model module so Base.metadata is complete.

Used by alembic/env.py (migrations) and test fixtures that need to
`Base.metadata.create_all`. Import this module for its side effects
only.
"""

from intent_core_api.ops import models as _ops_models  # noqa: F401
from intent_core_api.production_context import models as _production_context_models  # noqa: F401
