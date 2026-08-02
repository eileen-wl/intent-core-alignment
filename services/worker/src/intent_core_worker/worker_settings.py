from __future__ import annotations

from arq.connections import RedisSettings

from intent_core_worker.config import get_settings
from intent_core_worker.tasks import (
    ping,
    reconcile_ftrack_shots,
    reconcile_ftrack_versions_and_notes,
    write_back_core_anchor_confirmation,
)


class WorkerSettings:
    functions = [
        ping,
        reconcile_ftrack_shots,
        reconcile_ftrack_versions_and_notes,
        write_back_core_anchor_confirmation,
    ]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
