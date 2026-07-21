# FTRACK_FEASIBILITY.md

**Project:** Intent Core Alignment System
**Status:** Live findings from one real connected ftrack test workspace
**Purpose:** Record what is now verified fact about a real ftrack workspace,
so `docs/FTRACK_INTEGRATION.md`'s provisional mapping table and §16 open
questions can be resolved from evidence instead of guesses.

## 1. What was verified, and how

`services/ftrack-connector`'s `FtrackConnector.connect()` (ADR-0009) opened
a real `ftrack_api.Session` against a team-created ftrack trial workspace,
then `discover_workspace()` ran three read-only schema queries
(`ObjectType`, `Status`, `CustomAttributeConfiguration`) via
`python -m intent_core_connector`. This confirms real authentication and
real schema read access work end to end. Server hostname and the API
identity are intentionally not repeated here — they live only in the local,
gitignored `.env`, per `docs/API_AND_ACCOUNTS.md` §5.

The workspace's built-in demo project (`Napo (Animation demo)`) supplied a
pre-existing Project → Shot → Task → Version → Note hierarchy with a real
client-feedback Note, though this document only covers the schema-level
discovery findings below — entity-instance reads (an actual Shot/Task/
Version/Note payload) have not been attempted yet (see §3).

## 2. Findings, mapped to `docs/FTRACK_INTEGRATION.md` §16's open questions

| Open question (§16) | Finding |
|---|---|
| Which ftrack hierarchy entities are available? | 11 object types exist: Asset Build, Campaign, Episode, Folder, Image, Information, Milestone, Scene, Sequence, Shot, Task. |
| How are Sequence and Shot represented? | Both exist as distinct, real object types named exactly `Sequence` and `Shot` — no `Folder`-based simulation needed in this workspace. Confirms the `docs/FTRACK_INTEGRATION.md` §3 mapping table's `Sequence`/`Shot` rows can point directly at these names for this workspace. |
| Which Note parents are used in the workspace? | Not yet answered — discovery only queried schema (`ObjectType`/`Status`/`CustomAttributeConfiguration`), not actual `Note` instances or their parent relationships. Needs an entity-read pass (§3). |
| Can the API identity read required fields? | Yes — the discovery queries themselves prove read access to `ObjectType`, `Status`, and `CustomAttributeConfiguration`. |
| Can the API identity write required fields? | Not yet tested — no write attempted in this slice. |
| Which AssetVersion Components are accessible? | Not yet answered — not queried. |
| Which event payloads are received? | Not yet answered — the Event Hub is deliberately not connected in this slice (`auto_connect_event_hub=False`, ADR-0009). |
| Are Webhooks available and permitted? | Not yet answered. |
| Can Actions and Custom Widgets be configured? | Not yet answered — requires exploring the ftrack admin console, not API discovery. |
| How can system-originated write-back be marked? | Not yet answered — write-back is unimplemented (roadmap Phase 5). |
| Which Custom Attributes are useful? | 9 found (raw list in §2.1) — "useful" is a VFX/CG Supervisor judgment call, not an engineering one; listed here for their review, not pre-selected. |
| Which Status changes are safe to write? | Not yet answered — no write attempted. |

### 2.1 Raw findings

**Statuses (17):** Approved, Awaiting Client, Client approved, Completed,
Done, In progress, Needs Attention, Not started, Omitted, On Hold, Pending
Review, Post-Production, Production, Ready to start, Received, Revise, WIP.

**Custom attribute configurations (9):**

| Key | Label | On |
|---|---|---|
| `fstart` | Frame start | Shot |
| `fend` | Frame end | Shot |
| `handles` | Frame handles | Shot |
| `duration` | Frame duration | Shot |
| `fps` | fps | Shot |
| `fps` | fps | Sequence |
| `fps` | fps | show |
| `Tags` | Tags | Task |
| `animal label` | label | Task |

The `Shot`-level frame-range/fps fields (`fstart`/`fend`/`handles`/
`duration`/`fps`) are exactly the kind of technical boundary
`docs/PRODUCT_SCOPE.md` §5.2 describes a Secondary Execution Anchor
carrying — worth flagging to the CG Supervisor reviewing a future
`FtrackWorkspaceProfile.relevant_custom_attributes` list, not something
this document decides on its own.

## 3. Still open (not attempted in this pass)

- Reading actual entity instances (a real Shot/Task/Version/Note payload,
  not just schema) — natural next discovery step, still read-only, no
  contract changes needed.
- Note parent-relationship shape in practice.
- Event Hub connectivity and payload shape.
- Write-back (a test Note or Status change) and how to mark it
  system-originated.
- Component/Location accessibility for AssetVersion media.

## 4. Claim boundary (`docs/FTRACK_INTEGRATION.md` §15)

This validates technical integration with **one team-created ftrack trial
workspace**, using that workspace's own built-in demo project data. It
does **not** validate DNEG's custom workspace configuration, permissions,
live production data, performance at production scale, or adoption by real
DNEG teams.

## 5. Status

First real connection succeeded 2026-07-19. Findings above are from a
single discovery run against one workspace; not yet re-run to confirm
stability across sessions or after any workspace configuration change.
