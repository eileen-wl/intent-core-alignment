from __future__ import annotations

from pathlib import Path

from intent_core_connector.config import Settings

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_env_file_is_an_absolute_path_to_the_repo_root_dotenv() -> None:
    """Guards against reverting to a cwd-relative `env_file="".env""`.

    That form only finds the repo-root `.env` when the process happens
    to be invoked with cwd == repo root; it silently falls back to
    defaults otherwise (e.g. `cd services/ftrack-connector && uv run
    ...`). The absolute path must resolve to the same `.env`
    regardless of invocation cwd.
    """
    env_file = Settings.model_config["env_file"]

    assert Path(env_file).is_absolute()
    assert Path(env_file) == REPO_ROOT / ".env"
    # Sanity check the computed repo root is real, not a fluke.
    assert (REPO_ROOT / "pyproject.toml").is_file()
    assert (REPO_ROOT / ".env.example").is_file()
