"""Runs the full Alembic migration chain against a real file-based SQLite
database in a subprocess (not the in-memory `session` fixture, and not
in-process `command.upgrade`, since `alembic/env.py` resolves its DB URL
from `get_settings()`, which this test process has already cached against
the in-memory test DB by the time it runs -- see `tests/conftest.py`).

This is what actually exercises the SQLite-specific `batch_alter_table`
steps (0003, see its module docstring) against a real file, which the
in-memory StaticPool connection used elsewhere in the test suite does not
necessarily do identically.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

APPS_API_DIR = Path(__file__).resolve().parents[1]


def _run_alembic(args: list[str], database_url: str) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "DATABASE_URL": database_url, "REDIS_URL": "redis://localhost:6379/0"}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=APPS_API_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_migrations_upgrade_and_downgrade_against_file_based_sqlite(tmp_path: Path) -> None:
    db_path = tmp_path / "migration_test.db"
    database_url = f"sqlite+aiosqlite:///{db_path}"

    upgrade_result = _run_alembic(["upgrade", "head"], database_url)
    assert upgrade_result.returncode == 0, upgrade_result.stdout + upgrade_result.stderr
    assert db_path.exists()

    downgrade_result = _run_alembic(["downgrade", "base"], database_url)
    assert downgrade_result.returncode == 0, downgrade_result.stdout + downgrade_result.stderr
