from httpx import AsyncClient


async def test_worker_heartbeat_round_trip(client: AsyncClient) -> None:
    """Covers the callback the worker makes after processing a job.

    The enqueue endpoint (`POST /internal/ping-worker`) needs a live
    Redis connection and is covered by tests/integration instead.
    """
    missing = await client.get("/internal/worker-heartbeat/worker-ping")
    assert missing.status_code == 404

    upsert = await client.post(
        "/internal/worker-heartbeat",
        json={"name": "worker-ping", "pinged_at": "2026-07-13T00:00:00Z"},
    )
    assert upsert.status_code == 200
    assert upsert.json()["name"] == "worker-ping"

    read_back = await client.get("/internal/worker-heartbeat/worker-ping")
    assert read_back.status_code == 200
    assert read_back.json()["name"] == "worker-ping"
