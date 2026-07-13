from __future__ import annotations

from arq.connections import RedisSettings

from intent_core_worker.config import get_settings
from intent_core_worker.tasks import ping


class WorkerSettings:
    functions = [ping]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
