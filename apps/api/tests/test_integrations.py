import uuid

from httpx import AsyncClient
from intent_core_api.integrations.models import WritebackRecord
from sqlalchemy.ext.asyncio import AsyncSession


async def test_sync_cursor_404_when_never_set(client: AsyncClient) -> None:
    response = await client.get("/integrations/sync-cursor/ftrack_shot_reconciliation")
    assert response.status_code == 404


async def test_sync_cursor_upsert_creates_then_updates(client: AsyncClient) -> None:
    first = await client.put(
        "/integrations/sync-cursor/ftrack_shot_reconciliation",
        json={"last_synced_at": "2026-07-19T00:00:00Z"},
    )
    assert first.status_code == 200
    assert first.json()["key"] == "ftrack_shot_reconciliation"
    assert first.json()["last_synced_at"].startswith("2026-07-19T00:00:00")

    second = await client.put(
        "/integrations/sync-cursor/ftrack_shot_reconciliation",
        json={"last_synced_at": "2026-07-20T00:00:00Z"},
    )
    assert second.status_code == 200
    assert second.json()["last_synced_at"].startswith("2026-07-20T00:00:00")

    read_back = await client.get("/integrations/sync-cursor/ftrack_shot_reconciliation")
    assert read_back.status_code == 200
    assert read_back.json()["last_synced_at"].startswith("2026-07-20T00:00:00")


async def test_sync_cursor_keys_are_independent(client: AsyncClient) -> None:
    await client.put(
        "/integrations/sync-cursor/key-a", json={"last_synced_at": "2026-07-19T00:00:00Z"}
    )

    missing = await client.get("/integrations/sync-cursor/key-b")
    assert missing.status_code == 404


async def test_writeback_record_404_when_unknown(client: AsyncClient) -> None:
    response = await client.get(f"/integrations/writeback-records/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_writeback_record_get_and_patch(client: AsyncClient, session: AsyncSession) -> None:
    record = WritebackRecord(
        entity_type="core_anchor_revision",
        entity_id=uuid.uuid4(),
        source="ftrack",
        target_external_id="shot-external-1",
        content="[Intent Core Alignment System] test",
        status="pending",
        requested_by_actor_kind="human",
        requested_by_actor_id="vfx-1",
        requested_by_human_role="vfx_supervisor",
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    read_response = await client.get(f"/integrations/writeback-records/{record.id}")
    assert read_response.status_code == 200
    assert read_response.json()["status"] == "pending"
    assert read_response.json()["target_external_id"] == "shot-external-1"

    patch_response = await client.patch(
        f"/integrations/writeback-records/{record.id}",
        json={"status": "succeeded", "external_note_id": "note-1"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "succeeded"
    assert patch_response.json()["external_note_id"] == "note-1"
    assert patch_response.json()["completed_at"] is not None

    read_back = await client.get(f"/integrations/writeback-records/{record.id}")
    assert read_back.json()["status"] == "succeeded"


async def test_writeback_record_patch_404_when_unknown(client: AsyncClient) -> None:
    response = await client.patch(
        f"/integrations/writeback-records/{uuid.uuid4()}",
        json={"status": "failed", "error": "boom"},
    )
    assert response.status_code == 404
