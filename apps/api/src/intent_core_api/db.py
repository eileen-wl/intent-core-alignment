from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from intent_core_api.config import get_settings


class Base(DeclarativeBase):
    # Every model's `_utcnow()` default already produces a timezone-aware
    # UTC value, and every migration's raw DDL already declares
    # `sa.DateTime(timezone=True)` -- but a bare `Mapped[datetime]` column
    # annotation, with no type_annotation_map entry, resolves to
    # SQLAlchemy's *naive* `DateTime()` by default. This one mapping makes
    # every current and future `Mapped[datetime]` column across every
    # model consistent with that intent, without annotating each
    # mapped_column() call individually.
    type_annotation_map = {
        datetime: DateTime(timezone=True),
    }


_engine = create_async_engine(get_settings().database_url, echo=False)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session
