from __future__ import annotations

from intent_core_connector.connector import FtrackConnector


def main() -> None:
    connector = FtrackConnector()
    health = connector.health()
    print(f"ftrack-connector stub: configured={health.configured} detail={health.detail}")
    if not health.configured:
        print(
            "No ftrack workspace configured. This service is a stub -- "
            "see docs/FTRACK_INTEGRATION.md."
        )


if __name__ == "__main__":
    main()
