"""Guards against a bind mount shadowing the uv workspace's shared venv.

A uv workspace creates ONE shared virtual environment at the
workspace root (`/repo/.venv` in each Python service's container),
not one per member directory
(docs/decisions/ADR-0006-uv-for-python-workspace-management.md) --
confirmed by running a real `uv sync` with cwd inside a workspace
member and observing it modify the *root* `.venv`, not
`<member>/.venv`. A bind mount only needs to avoid targeting `/repo`
itself (or a parent of `/repo/.venv`); mounting a service's own
subdirectory is structurally disjoint from `/repo/.venv` and needs no
anonymous volume guard. An earlier fix ("B1") added anonymous volumes
for `/repo/<service>/.venv` on the mistaken assumption that uv places
a venv there -- those guarded paths never held anything and were
removed.

Stdlib-only static check on the compose file's text -- no Docker or
live infra required.
"""

from __future__ import annotations

from pathlib import Path

COMPOSE_PATH = Path(__file__).resolve().parents[2] / "infra" / "docker-compose.yml"

WORKSPACE_ROOT = "/repo"
VENV_PATH = "/repo/.venv"
PYTHON_SERVICES = ["api", "worker", "connector"]

# Regression guard: these were the incorrect per-service anonymous
# volumes the earlier "B1" fix added, guarding paths uv never uses.
STALE_PER_SERVICE_VENV_GUARDS = [
    "/repo/apps/api/.venv",
    "/repo/services/worker/.venv",
    "/repo/services/ftrack-connector/.venv",
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


def _bind_mount_targets(block: str) -> list[str]:
    """Container-side paths of host bind mounts in a service block.

    Skips named volumes (source doesn't start with `..`) and
    anonymous volumes (no `:` splitting source from target).
    """
    targets = []
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        mount = stripped[2:]
        if ":" not in mount or not mount.startswith(".."):
            continue
        _, target = mount.split(":", 1)
        targets.append(target)
    return targets


def test_python_service_mounts_do_not_shadow_workspace_venv() -> None:
    compose_text = COMPOSE_PATH.read_text(encoding="utf-8")

    for service_name in PYTHON_SERVICES:
        block = _service_block(compose_text, service_name)
        targets = _bind_mount_targets(block)
        assert targets, f"{service_name}: expected at least one source bind mount"

        for target in targets:
            assert target != WORKSPACE_ROOT, (
                f"{service_name}: mount targets the workspace root "
                f"({WORKSPACE_ROOT!r}) directly, which would shadow the shared "
                f"uv venv at {VENV_PATH!r}"
            )
            assert not VENV_PATH.startswith(target.rstrip("/") + "/"), (
                f"{service_name}: mount target {target!r} is a parent of "
                f"{VENV_PATH!r} and would shadow the shared uv venv"
            )


def test_no_stale_per_service_venv_volume_guard() -> None:
    compose_text = COMPOSE_PATH.read_text(encoding="utf-8")

    for path in STALE_PER_SERVICE_VENV_GUARDS:
        assert f"- {path}" not in compose_text, (
            f"found a stale per-service .venv volume guard for {path!r} -- the "
            "real uv workspace venv lives at /repo/.venv (ADR-0006)"
        )
