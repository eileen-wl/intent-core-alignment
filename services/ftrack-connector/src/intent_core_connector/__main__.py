from __future__ import annotations

from intent_core_connector.connector import FtrackConnector
from intent_core_connector.errors import IntegrationError


def main() -> None:
    connector = FtrackConnector()
    health = connector.health()
    print(f"ftrack-connector: configured={health.configured} detail={health.detail}")
    if not health.configured:
        print(
            "No ftrack workspace configured. This service is a stub -- "
            "see docs/FTRACK_INTEGRATION.md."
        )
        return

    try:
        connector.connect()
        report = connector.discover_workspace()
        sample = connector.read_sample_entities()
    except IntegrationError as exc:
        print(f"ftrack-connector: {exc}")
        return
    finally:
        connector.close()

    print(f"Connected to {report.server_url}")
    print(
        f"  object types ({len(report.object_type_names)}): {', '.join(report.object_type_names)}"
    )
    print(f"  statuses ({len(report.status_names)}): {', '.join(report.status_names)}")
    print(f"  custom attributes ({len(report.custom_attribute_configurations)}):")
    for cac in report.custom_attribute_configurations:
        print(f"    - {cac.key} ({cac.label}) on {cac.object_type_name or cac.entity_type}")
    print(
        "This is a raw discovery report, not a mapping -- hand-confirm "
        "FtrackWorkspaceProfile fields per docs/FTRACK_INTEGRATION.md §16."
    )

    print(f"\nSample entities (up to 5 each), server={report.server_url}:")
    print(f"  projects: {[(p.name, p.full_name) for p in sample.projects]}")
    print(f"  shots: {[(s.name, s.parent_name) for s in sample.shots]}")
    print(f"  tasks: {[(t.name, t.type_name, t.status_name) for t in sample.tasks]}")
    print(
        f"  versions: {[(v.asset_name, v.version_number, v.status_name) for v in sample.versions]}"
    )
    print(f"  notes: {[(n.author_name, n.content[:60]) for n in sample.notes]}")
    if sample.errors:
        print(f"  per-entity read errors: {sample.errors}")


if __name__ == "__main__":
    main()
