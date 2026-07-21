"""Guards against regressing the PEP 561 `py.typed` marker.

`intent_core_connector` is consumed by `services/worker` across a uv
workspace path dependency (ADR-0011), not a plain same-repo import, so
type checkers only trust its annotations if the installed distribution
ships `py.typed` (PEP 561). Build the real wheel with the project's
actual build backend and inspect it directly, rather than only
checking the source tree, so a build-configuration regression (e.g. an
`exclude` pattern accidentally dropping the file) would be caught too.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

from hatchling.builders.wheel import WheelBuilder

PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_wheel_includes_py_typed_marker(tmp_path: Path) -> None:
    builder = WheelBuilder(str(PACKAGE_ROOT))
    built = list(builder.build(directory=str(tmp_path)))

    assert built, "wheel build produced no artifacts"
    wheel_path = Path(built[0])
    assert wheel_path.suffix == ".whl"

    with zipfile.ZipFile(wheel_path) as wheel:
        names = wheel.namelist()

    assert "intent_core_connector/py.typed" in names, (
        f"built wheel is missing the PEP 561 py.typed marker -- contents were: {sorted(names)}"
    )
