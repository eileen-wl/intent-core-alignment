from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from intent_core_connector.connector import FtrackConnector
from intent_core_connector.errors import IntegrationError
from intent_core_connector.sync_client import sync_shot_context

from intent_core_worker.config import get_settings

# Key naming the reconciliation cursor at apps/api's /integrations/sync-cursor
# endpoint (ADR-0011). Only this job reads/writes it -- not a shared contract.
SYNC_CURSOR_KEY = "ftrack_shot_reconciliation"

# Bounded first-run window when no cursor exists yet -- not "sync everything
# ever" (ADR-0011).
_DEFAULT_LOOKBACK = timedelta(hours=24)


async def ping(ctx: dict[str, Any], heartbeat_name: str) -> None:
    """Prove the api -> Redis -> worker -> api async job path works.

    Not a real Agent capability -- see docs/AGENT_CONTRACTS.md for what
    a real capability's contract looks like. This only calls back to
    the api's ops heartbeat endpoint (intent_core_api.ops.router),
    which is the only place that writes to Postgres for this proof of
    wiring; the worker itself stays stateless.
    """
    settings = get_settings()
    async with httpx.AsyncClient(base_url=settings.api_base_url) as client:
        response = await client.post(
            "/internal/worker-heartbeat",
            json={
                "name": heartbeat_name,
                "pinged_at": datetime.now(UTC).isoformat(),
            },
        )
        response.raise_for_status()


async def reconcile_ftrack_shots(ctx: dict[str, Any]) -> None:
    """Poll ftrack for Shots with a new Task since the last successful
    run, and re-sync each one via the existing idempotent sync path
    (ADR-0011).

    `ftrack_api` (and therefore `FtrackConnector`) is synchronous;
    called directly here rather than adding a thread-pool bridge for
    this slice -- only services/worker imports intent_core_connector
    (ADR-0011), apps/api and Agents never touch it. The worker itself
    still never writes to Postgres directly (ADR-0008): the cursor and
    the synced Project/Shot/Task all go through apps/api over HTTP.
    """
    settings = get_settings()
    started_at = datetime.now(UTC)

    async with httpx.AsyncClient(base_url=settings.api_base_url) as client:
        cursor_response = await client.get(f"/integrations/sync-cursor/{SYNC_CURSOR_KEY}")
        if cursor_response.status_code == 404:
            since = started_at - _DEFAULT_LOOKBACK
        else:
            cursor_response.raise_for_status()
            since = datetime.fromisoformat(cursor_response.json()["last_synced_at"])

        connector = FtrackConnector()
        try:
            connector.connect()
        except IntegrationError:
            # Leave the cursor untouched so the next run retries the same
            # window (docs/FTRACK_INTEGRATION.md §13).
            return

        try:
            contexts = connector.read_shot_contexts_with_new_tasks(since=since)
        finally:
            connector.close()

        for shot_context in contexts:
            await sync_shot_context(shot_context, api_base_url=settings.api_base_url)

        cursor_write = await client.put(
            f"/integrations/sync-cursor/{SYNC_CURSOR_KEY}",
            json={"last_synced_at": started_at.isoformat()},
        )
        cursor_write.raise_for_status()


async def write_back_core_anchor_confirmation(
    ctx: dict[str, Any], writeback_record_id: str
) -> None:
    """Perform the ftrack write for one WritebackRecord (ADR-0012).

    apps/api already resolved the target Shot and composed the Note
    content when it created the record -- this job only reads it,
    writes the Note, and reports the outcome back. Same
    read-execute-report shape as `reconcile_ftrack_shots`.
    """
    settings = get_settings()

    async with httpx.AsyncClient(base_url=settings.api_base_url) as client:
        record_response = await client.get(f"/integrations/writeback-records/{writeback_record_id}")
        record_response.raise_for_status()
        record = record_response.json()

        connector = FtrackConnector()
        try:
            connector.connect()
            external_note_id = connector.write_note_to_shot(
                shot_external_id=record["target_external_id"], content=record["content"]
            )
        except IntegrationError as exc:
            await client.patch(
                f"/integrations/writeback-records/{writeback_record_id}",
                json={"status": "failed", "error": str(exc)},
            )
            return
        finally:
            connector.close()

        status_response = await client.patch(
            f"/integrations/writeback-records/{writeback_record_id}",
            json={"status": "succeeded", "external_note_id": external_note_id},
        )
        status_response.raise_for_status()
