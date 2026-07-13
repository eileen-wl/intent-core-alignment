"""Guards against regressing the .venv bind-mount shadowing bug (B1).

`infra/docker-compose.yml` bind-mounts each Python service's own
source directory into the container. Since `uv sync` installs that
service's `.venv` inside the same directory during the image build,
the bind mount would otherwise shadow it at runtime unless an
anonymous volume for `.venv` is also declared -- mirroring the
pattern already used for `web`'s `node_modules`/`.next`.

Stdlib-only static check on the compose file's text -- no Docker or
live infra required, so this can run anywhere pytest is available.
"""

from __future__ import annotations

from pathlib import Path

COMPOSE_PATH = Path(__file__).resolve().parents[2] / "infra" / "docker-compose.yml"

# (service name, bind mount, required anonymous .venv guard)
PYTHON_SERVICES = [
    ("api", "../apps/api:/repo/apps/api", "/repo/apps/api/.venv"),
    (
        "worker",
        "../services/worker:/repo/services/worker",
        "/repo/services/worker/.venv",
    ),
    (
        "connector",
        "../services/ftrack-connector:/repo/services/ftrack-connector",
        "/repo/services/ftrack-connector/.venv",
    ),
]


def _service_block(compose_text: str, service_name: str) -> str:
    """Return the raw text of one top-level service block."""
    lines = compose_text.splitlines()
    start = next(i for i, line in enumerate(lines) if line == f"  {service_name}:")
    end = len(lines)
    for i in range(start + 1, len(lines)):
        is_top_level_key = lines[i] and not lines[i].startswith(" ")
        is_next_service = (
            lines[i].startswith("  ")
            and not lines[i].startswith("   ")
            and lines[i].strip().endswith(":")
        )
        if is_top_level_key or is_next_service:
            end = i
            break
    return "\n".join(lines[start:end])


def test_python_services_preserve_image_built_venv() -> None:
    compose_text = COMPOSE_PATH.read_text(encoding="utf-8")

    for service_name, bind_mount, venv_guard in PYTHON_SERVICES:
        block = _service_block(compose_text, service_name)
        assert bind_mount in block, f"{service_name}: expected bind mount {bind_mount!r} not found"
        assert venv_guard in block, (
            f"{service_name}: bind mount {bind_mount!r} shadows the image-built "
            f".venv unless an anonymous volume for {venv_guard!r} is also present"
        )
