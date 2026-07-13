"""Write the live OpenAPI document to stdout without starting a server.

Used by `packages/contracts/ts`'s generate script:

    uv run --project apps/api python -m intent_core_api.export_openapi \\
      > apps/api/openapi.json
"""

from __future__ import annotations

import json
import sys

from intent_core_api.main import app


def main() -> None:
    json.dump(app.openapi(), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
