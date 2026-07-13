from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


class WorkerHeartbeat(Base):
    """Last time a named background job reported back to the API.

    Not part of the product domain model (docs/DOMAIN_MODEL.md) --
    scaffolding only, see intent_core_api.ops.__init__.
    """

    __tablename__ = "worker_heartbeats"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    last_ping_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
