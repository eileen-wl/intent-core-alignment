"""Write a controlled Note back to a real ftrack Shot (ADR-0012).

`docs/FTRACK_INTEGRATION.md` §12: only human-confirmed content reaches
here -- the caller (services/worker's write-back job) already has the
final Note text and the target Shot's external id resolved by
apps/api; this module performs the write and nothing else. No
auto-approval, no raw Agent output -- write-back policy is enforced by
what apps/api chooses to put in a WritebackRecord, not by this module.
"""

from __future__ import annotations

import ftrack_api

from intent_core_connector.errors import IntegrationError


def write_note_to_shot(session: ftrack_api.Session, *, shot_external_id: str, content: str) -> str:
    """Create a Note on the given Shot and return the new Note's id."""
    try:
        shot = session.get("Shot", shot_external_id)
    except Exception as exc:  # noqa: BLE001 -- see errors.py
        raise IntegrationError(f"Failed to look up Shot {shot_external_id}: {exc}") from exc

    if shot is None:
        raise IntegrationError(f"Shot {shot_external_id} not found in ftrack")

    try:
        # create_note() requires an explicit author (verified against a
        # real workspace: omitting it raises a TypeError, not a default-
        # to-session-identity behavior) -- the configured API identity is
        # the only sensible author for a system-written Note.
        author = session.query(f'User where username is "{session.api_user}"').first()
        if author is None:
            raise IntegrationError(
                f"Configured API user {session.api_user!r} not found as a ftrack User"
            )
        note = shot.create_note(content, author=author)
        session.commit()
    except IntegrationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise IntegrationError(f"Failed to write Note to Shot {shot_external_id}: {exc}") from exc

    return str(note["id"])
