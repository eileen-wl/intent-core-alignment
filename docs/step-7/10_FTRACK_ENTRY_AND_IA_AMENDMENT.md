# ICAS Step 7 — ftrack Entry and Information-Architecture Amendment

**Version:** v1.0
**Status:** Locked
**Amends:** `03_STEP_7A2_INFORMATION_ARCHITECTURE_ROUTES.md`, `05_STEP_7A4_WIREFRAMES_VISUAL_SYSTEM_DEMO.md`, `06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md`, `09_STEP_7B2_IMPLEMENTATION_NOTE.md`
**Scope:** Narrow correction before Step 7B-3, made on top of an already-implemented Step 7B-2. Does not reopen the role model, route structure, Anchor authority, HumanGate rules, or four-Agent architecture.

---

## 1. Three entry modes

ICAS has exactly three distinct ways to enter the product. They are not
interchangeable, and none of them replace the backend's existing
actor-authority enforcement.

| Mode | Entry | Identity source | Audience |
|---|---|---|---|
| **Production** | ftrack Action/Widget (future, Step 8) | Verified ftrack user + project-role mapping | Real production users |
| **Portfolio Demo** | `/demo` | Session-scoped cookie, manually selected | Reviewers, presentations |
| **Development** | `/dev`, legacy `/shots` | Raw Role/Actor ID controls | Engineers, manual smoke tests |

None of these three modes shares an identity mechanism with another. The
Demo cookie is not a preview of the production session; it is a
portfolio-only stand-in that will be retired once Step 8's production
entry exists, not upgraded into it.

---

## 2. Future ftrack production-entry flow (Step 8, not implemented here)

```text
ftrack Action or Widget
→ verified ftrack user
→ selected Project / Shot / Task / Version context
→ ICAS user and project-role mapping
→ short-lived server-side ICAS session
→ redirect to the appropriate role and contextual object workspace
```

This flow is recorded now so Step 7's Demo entry is understood as a
stand-in for it, not a competing design. **None of it is implemented in
Step 7.**

---

## 3. Identity and role-resolution rules (locked)

1. A production user must **not** manually choose VFX Supervisor, CG
   Supervisor, or Artist after launching from ftrack. Role is resolved,
   not selected.
2. **ftrack identity alone does not equal an ICAS production role.** A
   verified ftrack user is a necessary input, not a sufficient one.
3. Role resolution must consider all of:
   - the verified ftrack user;
   - the current Project;
   - the selected production entity (Shot / Task / Version);
   - assignment or responsibility context for that entity;
   - an explicit ICAS project-role mapping (a persisted record connecting
     an ftrack user, a Project, and an ICAS production role — not
     inferred from ftrack alone).
4. No credentials, API keys, or trusted identity values may ever be
   placed in a query parameter or in a client-visible cookie. The
   existing Demo cookie is `httpOnly` and holds only a role literal;
   any future production session cookie must hold no more than an
   opaque, short-lived session reference.
5. Real ftrack launch, ftrack identity validation, object-context
   validation, project-role mapping persistence, and ICAS session
   creation are **Step 8 scope**. Nothing here is implemented in Step 7.
6. The existing role-prefixed routes (`/vfx`, `/cg`, `/artist`, and
   their contextual sub-routes) remain valid redirect targets for the
   future production-entry flow — Step 8 redirects into the same
   routes Step 7 already built, it does not replace them.

---

## 4. Demo-entry hierarchy correction

The three equally-weighted role cards on `/demo` were too direct for a
portfolio entry point and have been corrected.

### Before (Step 7B-2, original)

Three equal role cards, no hierarchy, no explanation of what launching
from ftrack will eventually look like.

### After (this amendment)

> **Corrected by `14_STEP_7C0B_...md` §8:** "Start guided demonstration"
> was originally understood to enter as VFX Supervisor and land on
> `/vfx` (the Alignment Inbox), matching the general
> `enterDemoRole`/`ROLE_HOME_PATH` mechanism used by the three direct
> role-entry cards below. Step 7C-0B review found this was never
> actually backed by persisted D1 Demo data (no seed/bootstrap script
> exists), and separately decided that a guided single-Shot demo
> should not stop at a triage Inbox first. The dominant action is now
> corrected below to resolve the real D1 Shot server-side and redirect
> straight to `/vfx/shots/:shotId`; the three direct role-entry cards
> in "Explore by role" are unchanged and still land on each role's
> plain homepage (`/vfx`, `/cg`, `/artist`).

```text
ICAS
Guided portfolio demonstration

D1 Demo Project · Shot 010 — Final confrontation
(shared scenario summary, unchanged)

┌─────────────────────────────────────────────┐
│  Start guided demonstration                   │  <- one dominant primary action
│  (enters as VFX Supervisor →                  │
│   resolves the real D1 Shot server-side →     │
│   /vfx/shots/:shotId, not /vfx first)          │
└─────────────────────────────────────────────┘

Production users will ultimately launch ICAS directly from ftrack --
their verified identity and current Project, Shot, Task, or Version
context will determine the workspace they enter.

▸ Explore by role                       <- collapsed by default,
    VFX Supervisor   [Enter as ...]        visually quiet, keyboard
    CG Supervisor    [Enter as ...]        accessible
    Artist           [Enter as ...]
```

Both the primary action and each direct role entry call the **exact
same** `enterDemoRole` Server Action and the exact same session-scoped
cookie mechanism — only the visual weight differs (a bold primary
button vs. a quiet secondary button inside a collapsed `<details>`
disclosure), **and, per the correction above, the primary action alone
additionally calls the new server-side D1 Shot resolver
(`14_...md` §8.2) before redirecting** -- the three direct role-entry
cards do not, and continue to redirect to their plain role homepage.
No new identity mechanism, no new route-protection
behaviour, no bypass of the existing middleware lock.

The guided demonstration currently only starts as VFX Supervisor. A
later batch may add a structured VFX → CG → Artist guided progression;
this amendment records that intent but does not implement it.

---

## 5. VFX and CG contextual-navigation corrections

### 5.1 VFX Shot navigation

**Previous primary tabs:**

```text
Overview
Intent
Version Review
Alignment
Decisions
Activity
```

**Corrected primary tabs:**

```text
Overview
Intent
Versions
Alignment
Activity
```

**Reason:** Decisions are contextual records produced inside Intent,
Alignment, HumanGate, and Activity flows. An isolated top-level
`Decisions` tab lost the originating context (which Anchor revision,
which Assessment, which gate) that makes a Decision meaningful.
Decision visibility is distributed instead:

- Core Anchor and HumanGate decisions appear **inside Intent**;
- cross-role coordination decisions appear **inside Alignment**;
- historical and superseded decisions appear **inside Activity**.

`Version Review` becomes `Versions` — see §6.

### 5.2 CG Task navigation

**Previous:** a singular `Version Review` tab.

**Corrected CG Task tabs:**

```text
Overview
Execution
Versions
Dependencies
Activity
```

**Reason:** a Task may contain multiple Versions. Primary navigation
must lead to a Version **collection** first, not straight to a single
Version's detail/review — the same reasoning as the VFX correction.

### 5.3 Artist Task navigation (unchanged, reaffirmed)

```text
Task Overview
Current Version
Feedback History
```

Artist intentionally does **not** get a Version-collection tab. Artist
prioritises the single currently-actionable Version, not management of
the full Version history — this is the correct, deliberate asymmetry
with VFX/CG, not an oversight.

---

## 6. Version collection routes (planned, not implemented)

Added to the planned route table:

```text
/vfx/shots/:shotId/versions
/cg/tasks/:taskId/versions
```

The existing planned Version **detail** routes are unchanged:

```text
/vfx/shots/:shotId/versions/:versionId
/cg/tasks/:taskId/versions/:versionId
```

Neither the collection routes nor any page content for them is
implemented in this task or in Step 7B-2.

---

## 7. Integrations placement correction

The VFX Integration overview (`/vfx/integrations`) is corrected from an
implied primary daily destination to its proper place:

- a **secondary, System/technical-status destination**;
- valuable for demonstration and operational transparency;
- **not** part of the VFX Supervisor's primary daily workflow (which
  remains Alignment Inbox → Shot Overview → Intent/Alignment).

Object-level ftrack linkage remains visible **in context**, not
centralised, on:

- Project;
- Shot;
- Task;
- Version;
- ReviewNote.

No ftrack linkage component or business logic is implemented in this
task — this section only corrects where the future components belong.

---

## 8. Intent Signal honesty rule

Step 7 shows exactly one thing: **`Latest Intent Signal`**, derived
deterministically from the latest successful Cross-role Assessment.

It must never be presented, worded, or animated as:

- continuous monitoring;
- a live "unread" notification;
- an always-running production watcher;
- an automatically-updating real-time feed.

It is a snapshot of the last successful Assessment, nothing more. Step
8 may later add newly-synced ftrack production context that lets a
human trigger a **new** Assessment (and therefore a new Intent Signal)
— but that action remains human-initiated, not automatic, and remains
out of scope here.

---

## 9. Real-software implementation standard

ICAS is not an enterprise platform, but it must be **real, runnable
software** — not a visual-only or navigation-only prototype. The final
implementation must use the **same** real domain model, APIs, routes,
and workflow logic for both normal production use and the portfolio
Demo. There is no separate fake Demo-only domain implementation.

Required real-implementation qualities (already true for Steps 0–6,
reaffirmed here as the standard the remaining Step 7 batches must keep
building toward, not a new scope item):

- PostgreSQL persistence;
- immutable or auditable domain records where already designed;
- real `ContextSnapshot` creation;
- real `AgentRun` records;
- real Core Agent and Role Agent execution;
- real HumanGate decisions;
- real human authority enforcement;
- real Cross-role Assessment;
- real Re-anchor Proposal;
- real derived Intent Signal;
- real evidence and provenance;
- real server-side role/session enforcement;
- real ftrack read-only sync (Step 8);
- real controlled write-back (Step 8);
- explicit error, permission, and unavailable states — never a
  fabricated success.

The portfolio Demo **may** use seeded production data as a stable
fallback when live Agent generation is unavailable, but that seeded
data must flow through the same domain objects, APIs, routes, and
workflow logic as the real system — never a parallel mock system.

### Explicitly excluded enterprise features (unless later approved)

- enterprise SSO;
- organisation administration;
- complex RBAC management UI;
- chat;
- notification lifecycle;
- SLA management;
- real-time collaborative editing;
- a global enterprise activity centre;
- bulk operations;
- full production scheduling.

---

## 10. Explicit implementation deferrals

Not implemented by this amendment or by the Step 7B-2 correction it
accompanies:

- real ftrack Action or Widget;
- ftrack user authentication;
- ftrack-user-to-ICAS-identity mapping;
- project-role mapping persistence;
- production ICAS session creation;
- Version collection pages (`/vfx/shots/:shotId/versions`,
  `/cg/tasks/:taskId/versions`);
- real VFX, CG, or Artist dashboard data;
- Intent Signal UI components;
- ftrack linkage UI components;
- cross-role guided-demo progression (VFX → CG → Artist as a single
  structured flow);
- any backend, database, migration, or API contract change;
- any Agent capability, HumanGate, or Anchor workflow change.

These remain Step 7B-3, Step 7C, or Step 8 scope, as applicable.
