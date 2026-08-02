"""GET .../versions/{version_id}/media -- Step 9B-4's context-scoped,
read-only ftrack media resolution endpoints (VFX Shot-wide, CG/Artist
Task-scoped).

The real ftrack connector is never exercised here (that lives in
services/ftrack-connector/tests/test_media_context.py) -- this file
mocks the resolver boundary (`version_media.resolver.get_media_resolver`,
overridden via the same `app.dependency_overrides` mechanism
`tests/conftest.py` already uses for `get_session`) and focuses on
authorization, context-scoping, and the service's own tier-classification/
fallback logic.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.main import app
from intent_core_api.version_media.resolver import get_media_resolver
from intent_core_api.versions_and_feedback.models import Version
from intent_core_connector.errors import IntegrationConnectionError
from intent_core_connector.media_context import AssetVersionMediaContext
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


class _FakeResolver:
    def __init__(
        self,
        context: AssetVersionMediaContext | None = None,
        error: Exception | None = None,
    ) -> None:
        self.context = context
        self.error = error
        self.calls: list[str] = []

    async def __call__(self, *, version_external_id: str) -> AssetVersionMediaContext:
        self.calls.append(version_external_id)
        if self.error is not None:
            raise self.error
        assert self.context is not None
        return self.context


def _override_resolver(resolver: _FakeResolver) -> None:
    app.dependency_overrides[get_media_resolver] = lambda: resolver


async def _create_project_and_shot(
    client: AsyncClient, shot_name: str = "SH010"
) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": shot_name})
    ).json()
    return str(project["id"]), str(shot["id"])


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Compositing") -> str:
    task = (
        await client.post("/tasks", json={"shot_id": shot_id, "name": name, "department": "comp"})
    ).json()
    return str(task["id"])


async def _create_manual_version(client: AsyncClient, shot_id: str) -> str:
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": "v001", "description": "manual"},
            headers=VFX,
        )
    ).json()
    return str(version["id"])


async def _create_linked_version(
    session: AsyncSession,
    *,
    shot_id: uuid.UUID,
    task_id: uuid.UUID | None,
    external_id: str = "av-1",
) -> uuid.UUID:
    version = Version(
        shot_id=shot_id,
        task_id=task_id,
        name="ftrack_v001",
        version_number=1,
        description="",
        source="ftrack",
        source_created_at=datetime(2026, 8, 1, tzinfo=UTC),
        created_by_actor_kind="system",
        created_by_actor_id="ftrack-sync",
        created_by_human_role=None,
    )
    session.add(version)
    await session.flush()
    session.add(
        ExternalEntityLink(
            entity_type="version", entity_id=version.id, source="ftrack", external_id=external_id
        )
    )
    await session.commit()
    await session.refresh(version)
    return version.id


def _playable_context(**overrides: Any) -> AssetVersionMediaContext:
    base: dict[str, Any] = {
        "exists": True,
        "thumbnail_url": "https://ftrack.example/thumb?sig=abc",
        "playable_url": "https://ftrack.example/video?sig=def",
        "playable_media_type": "video/mp4",
        "playable_component_name": "ftrackreview-mp4",
    }
    base.update(overrides)
    return AssetVersionMediaContext(**base)


@pytest.fixture(autouse=True)
def _clear_overrides() -> Any:
    yield
    app.dependency_overrides.pop(get_media_resolver, None)


# --- VFX: Shot-wide authorization and context -------------------------------


async def test_vfx_supervisor_can_resolve_media_in_correct_shot_context(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    _override_resolver(_FakeResolver(context=_playable_context()))

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    assert response.status_code == 200
    body = response.json()
    assert body["media_state"] == "playable"
    assert body["ftrack_linked"] is True
    assert body["thumbnail_url"] == "https://ftrack.example/thumb?sig=abc"
    assert body["playable_url"] == "https://ftrack.example/video?sig=def"
    assert response.headers["cache-control"] == "no-store"


async def test_cg_supervisor_is_rejected_on_the_vfx_route(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    _override_resolver(_FakeResolver(context=_playable_context()))

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=CG)

    assert response.status_code == 403


async def test_missing_identity_is_rejected(client: AsyncClient, session: AsyncSession) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media")

    assert response.status_code == 401


async def test_invalid_role_header_is_rejected(client: AsyncClient, session: AsyncSession) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)

    response = await client.get(
        f"/vfx/shots/{shot_id}/versions/{version_id}/media",
        headers={"X-Actor-Role": "not_a_real_role", "X-Actor-Id": "x-1"},
    )

    assert response.status_code == 401


async def test_version_from_another_shot_is_rejected_for_vfx(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_a = await _create_project_and_shot(client, shot_name="SH010")
    _project_id_b, shot_b = await _create_project_and_shot(client, shot_name="SH020")
    version_in_b = await _create_linked_version(session, shot_id=uuid.UUID(shot_b), task_id=None)
    _override_resolver(_FakeResolver(context=_playable_context()))

    response = await client.get(f"/vfx/shots/{shot_a}/versions/{version_in_b}/media", headers=VFX)

    assert response.status_code == 404


async def test_missing_shot_returns_not_found(client: AsyncClient) -> None:
    response = await client.get(
        f"/vfx/shots/{uuid.uuid4()}/versions/{uuid.uuid4()}/media", headers=VFX
    )

    assert response.status_code == 404


async def test_missing_version_in_a_real_shot_returns_not_found(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{uuid.uuid4()}/media", headers=VFX)

    assert response.status_code == 404


async def test_arbitrary_client_supplied_external_id_cannot_be_injected(
    client: AsyncClient, session: AsyncSession
) -> None:
    """The route only ever accepts a local Version id -- there is no
    request field for an external ftrack id at all, so a client cannot
    ask this endpoint to resolve media for an arbitrary AssetVersion it
    does not otherwise have access to."""
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_manual_version(client, shot_id)

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    assert response.status_code == 200
    assert response.json()["ftrack_linked"] is False


# --- CG/Artist: Task-scoped authorization and context -----------------------


async def test_cg_supervisor_can_resolve_media_for_a_task_linked_version(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_linked_version(
        session, shot_id=uuid.UUID(shot_id), task_id=uuid.UUID(task_id)
    )
    _override_resolver(_FakeResolver(context=_playable_context()))

    response = await client.get(f"/cg/tasks/{task_id}/versions/{version_id}/media", headers=CG)

    assert response.status_code == 200
    assert response.json()["media_state"] == "playable"


async def test_artist_can_resolve_media_for_a_task_linked_version(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_linked_version(
        session, shot_id=uuid.UUID(shot_id), task_id=uuid.UUID(task_id)
    )
    _override_resolver(_FakeResolver(context=_playable_context()))

    response = await client.get(
        f"/artist/tasks/{task_id}/versions/{version_id}/media", headers=ARTIST
    )

    assert response.status_code == 200
    assert response.json()["media_state"] == "playable"


async def test_vfx_supervisor_is_rejected_on_the_cg_route(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_linked_version(
        session, shot_id=uuid.UUID(shot_id), task_id=uuid.UUID(task_id)
    )

    response = await client.get(f"/cg/tasks/{task_id}/versions/{version_id}/media", headers=VFX)

    assert response.status_code == 403


async def test_artist_is_rejected_on_the_cg_route(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_id = await _create_task(client, shot_id)
    version_id = await _create_linked_version(
        session, shot_id=uuid.UUID(shot_id), task_id=uuid.UUID(task_id)
    )

    response = await client.get(f"/cg/tasks/{task_id}/versions/{version_id}/media", headers=ARTIST)

    assert response.status_code == 403


async def test_version_linked_to_a_different_task_is_rejected_for_cg(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    task_a = await _create_task(client, shot_id, name="Compositing")
    task_b = await _create_task(client, shot_id, name="Lighting")
    version_for_b = await _create_linked_version(
        session, shot_id=uuid.UUID(shot_id), task_id=uuid.UUID(task_b)
    )

    response = await client.get(f"/cg/tasks/{task_a}/versions/{version_for_b}/media", headers=CG)

    assert response.status_code == 404


async def test_nullable_task_compatibility_accepted_only_within_the_same_shot(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_a = await _create_project_and_shot(client, shot_name="SH010")
    _project_id_b, shot_b = await _create_project_and_shot(client, shot_name="SH020")
    task_in_a = await _create_task(client, shot_a)
    task_in_b = await _create_task(client, shot_b)
    # A nullable-task_id Version belonging to Shot A's own Version pool.
    shared_version = await _create_linked_version(session, shot_id=uuid.UUID(shot_a), task_id=None)
    _override_resolver(_FakeResolver(context=_playable_context()))

    accepted = await client.get(
        f"/cg/tasks/{task_in_a}/versions/{shared_version}/media", headers=CG
    )
    assert accepted.status_code == 200

    rejected = await client.get(
        f"/cg/tasks/{task_in_b}/versions/{shared_version}/media", headers=CG
    )
    assert rejected.status_code == 404


async def test_missing_task_returns_not_found(client: AsyncClient) -> None:
    response = await client.get(
        f"/cg/tasks/{uuid.uuid4()}/versions/{uuid.uuid4()}/media", headers=CG
    )

    assert response.status_code == 404


# --- Honest fallback states --------------------------------------------------


async def test_manual_version_returns_honest_not_linked_state_not_a_server_error(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_manual_version(client, shot_id)

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    assert response.status_code == 200
    body = response.json()
    assert body["ftrack_linked"] is False
    assert body["media_state"] == "unavailable"
    assert body["unavailable_reason"]
    assert body["thumbnail_url"] is None
    assert body["playable_url"] is None


async def test_deleted_ftrack_asset_version_returns_honest_unavailable_state(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    _override_resolver(_FakeResolver(context=AssetVersionMediaContext(exists=False)))

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    assert response.status_code == 200
    body = response.json()
    assert body["ftrack_linked"] is True
    assert body["media_state"] == "unavailable"
    assert "deleted" in body["unavailable_reason"].lower()


async def test_ftrack_service_unavailable_returns_honest_state_not_a_500(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    _override_resolver(_FakeResolver(error=IntegrationConnectionError("ftrack unreachable")))

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    assert response.status_code == 200
    body = response.json()
    assert body["media_state"] == "unavailable"
    assert body["ftrack_linked"] is True


async def test_thumbnail_only_state(client: AsyncClient, session: AsyncSession) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    _override_resolver(
        _FakeResolver(
            context=_playable_context(
                playable_url=None, playable_media_type=None, playable_component_name=None
            )
        )
    )

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    body = response.json()
    assert body["media_state"] == "thumbnail_only"
    assert body["thumbnail_url"] is not None
    assert body["playable_url"] is None


async def test_external_context_only_state_when_nothing_resolves(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    _override_resolver(
        _FakeResolver(
            context=AssetVersionMediaContext(exists=True, thumbnail_url=None, playable_url=None)
        )
    )

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    body = response.json()
    assert body["media_state"] == "external_context_only"
    assert body["ftrack_linked"] is True
    assert body["thumbnail_url"] is None
    assert body["playable_url"] is None


# --- Safety: no mutation, no secret leakage ----------------------------------


async def test_read_only_no_mutation(client: AsyncClient, session: AsyncSession) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    fake_resolver = _FakeResolver(context=_playable_context())
    _override_resolver(fake_resolver)

    first = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)
    second = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    first_body, second_body = first.json(), second.json()
    # `resolved_at` is intentionally fresh per call (never cached/stored
    # server-side) -- every other field is stable across two identical,
    # read-only requests.
    first_body.pop("resolved_at")
    second_body.pop("resolved_at")
    assert first_body == second_body
    assert len(fake_resolver.calls) == 2  # resolved fresh each time, never cached server-side

    version = await session.get(Version, version_id)
    assert version is not None
    assert version.name == "ftrack_v001"  # unchanged


async def test_no_signed_url_or_secret_appears_in_an_error_response(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_linked_version(session, shot_id=uuid.UUID(shot_id), task_id=None)
    _override_resolver(
        _FakeResolver(error=IntegrationConnectionError("secret-looking-token-abc123 leaked?"))
    )

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    assert response.status_code == 200
    assert "secret-looking-token-abc123" not in response.text


async def test_no_raw_uuid_in_unavailable_reason_text(
    client: AsyncClient, session: AsyncSession
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_manual_version(client, shot_id)

    response = await client.get(f"/vfx/shots/{shot_id}/versions/{version_id}/media", headers=VFX)

    body = response.json()
    assert version_id not in (body["unavailable_reason"] or "")
