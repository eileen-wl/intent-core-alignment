# AGENTS.md

## Repository purpose

This repository implements the **Intent Core Alignment System (ICAS)**: an independent,
role-aware, AI-assisted creative-intent alignment product for animation/VFX workflows,
with ftrack as the first formal Workflow Connector.

This file is the stable entry point for Codex. Detailed product-improvement decisions live in:

- `docs/product-improvement/00_ICAS_PRODUCT_IMPROVEMENT_BASELINE.md`

Before product-improvement work, read that baseline first, then only the directly relevant
contracts and modules.

## Product north star

ICAS must remain:

```text
Role-aware Workspace
+ Anchor-first experience
+ visible Agent workflow
+ human-controlled authority
+ continuous alignment and re-anchor loop
```

Do not turn ICAS into a generic production tracker, a chatbot collection, or a passive review
archive.

## Locked product decisions

1. Keep the three human roles and current role-prefixed product routes:
   - VFX Supervisor: `/vfx/**`
   - CG Supervisor: `/cg/**`
   - Artist: `/artist/**`
2. Add a persistent **Anchor Context Layer** across key role-aware pages; do not replace the
   role-aware IA with a new Anchor-only app.
3. The Golden Demo Journey ends with a human-confirmed `Core Anchor Revision 2`, then propagates
   downstream again.
4. The Golden Demo supports both `Reset journey` and `Load completed journey`.
5. One shared Core Anchor branches into three representative department Tasks:
   - Animation
   - Lighting
   - Compositing
6. Department-specific Artists remain the same `artist` authorization role. Do not create new
   application roles or duplicate `/animation`, `/lighting`, or `/compositing` workspaces.
7. Current formal product routes are `/`, `/vfx/**`, `/cg/**`, and `/artist/**`.
   - Treat `/shots/**` as legacy capability-reference routes only.
   - Treat `/dev/**` as development-only routes.
   - Do not add new product features only to legacy routes.

## Authority and safety rules

- Agents must not call ftrack directly.
- External production data must pass through the Connector and internal model.
- Production Evidence, Agent Interpretation, and Human Decision/Provenance must remain distinct.
- Agents may create drafts, reviews, guidance, assessments, signals, and proposals.
- Agents may not confirm Anchors, create Human Decisions, approve Versions, resolve Human Gates,
  or perform unapproved write-back.
- VFX Supervisors confirm Core Anchors.
- CG Supervisors confirm Execution Anchors.
- Artists cannot modify either Anchor type.
- Confirmed records are revisioned; never overwrite history.
- Enforce permissions in backend logic, not only in UI or prompts.
- ftrack stays read-only unless an explicitly approved controlled write-back task says otherwise.
- Never expose, print, persist, commit, or return credentials or credential-bearing media URLs.
- Do not hard-code synthetic demo behaviour into normal product services.

## Capability truthfulness

Never equate these statements:

- backend service exists;
- endpoint exists;
- legacy page exposes it;
- current role-aware UI exposes it;
- current Demo data can demonstrate it;
- the product capability is complete.

For every capability changed, classify its state explicitly as one of:

- implemented and visible;
- implemented but hidden/conditional;
- implemented on legacy route only;
- designed but not implemented;
- obsolete/duplicate and frozen.

Do not claim a Design Concept capability is complete unless a user can discover and complete it
through the current role-aware product journey.

## Golden Journey rule

Product changes should support the same coherent journey:

```text
VFX Intent Brief
→ Core Agent decomposition/context reconstruction/Core Anchor draft
→ VFX human confirmation
→ CG Agent department-specific Execution Anchor drafts
→ CG human confirmation
→ department Artist guidance and execution
→ Version and Review Note
→ CG technical review + VFX creative review
→ cross-role/cross-department assessment
→ Intent Signal and Re-anchor Proposal
→ VFX human-confirmed Core Anchor Revision 2
→ downstream Execution Anchors and Artist Guidance become outdated and are regenerated
```

Do not optimise one page in a way that weakens this end-to-end journey.

## Demo data worlds

Keep these visibly and operationally separate:

1. **Golden Demo Scenario** — coherent narrative data used for the complete user journey.
2. **Live ftrack Data** — real integration evidence; it need not contain a complete synthetic
   Anchor/Agent story.
3. **Development Fixtures** — lifecycle, empty, error, and authorization test states; hidden from
   the normal Demo journey.

A Demo reset may only mutate Demo-scoped data. It must not modify live ftrack-linked data or
unrelated local records.

## Working method

### Before implementation

For a product-improvement package:

1. Read the product-improvement baseline.
2. Inspect current code as the source of truth for actual implementation.
3. Read only directly relevant contracts/modules; do not re-audit all Step 1–9 history.
4. State the user journey being improved.
5. Identify existing current-route, legacy-route, backend-only, and missing capabilities.
6. Propose one bounded package plan.
7. Do not modify shared contracts, permissions, migrations, or Demo semantics without making the
   change explicit.

### Branch and scope

- Use one branch per coherent product-improvement package.
- Do not create a branch for every small visual correction.
- Keep unrelated cleanup out of the package.
- Reuse existing services/components from legacy routes when their contracts remain correct;
  migrate them into role-aware routes instead of rebuilding them.

### Documentation

For the improvement phase, maintain only:

- the master product-improvement baseline;
- one implementation note per large package;
- the main roadmap.

Do not create a new closeout document for every minor correction.

## Test strategy

Do not run the complete repository regression after every small change.

### Documentation-only change

Run only:

- `git diff --check`
- any directly relevant documentation/link check already available

Do not run full pytest/Vitest/build for documentation-only work.

### During implementation

Run focused tests for touched behaviour and touched package type checks/lint where useful.

Examples:

- focused API/service tests for changed backend modules;
- focused component/page tests for changed frontend modules;
- contract generation/check only when API schemas change.

### Package validation gate

Before owner validation, run the relevant integration suites for the package and one coherent
Golden Journey test/path.

### Merge gate

Run the full repository regression once per completed package, or rely on CI when explicitly
approved:

- Python tests/type checks/lint/format checks;
- frontend Vitest/typecheck/lint/Prettier/build;
- contract consistency when applicable;
- `uv lock --check` when Python dependencies or lock-sensitive config changed.

Do not weaken tests to make a change pass.

## Windows/local environment

The primary local environment is Windows with VS Code PowerShell.

When giving manual commands:

- identify the terminal type;
- state whether commands may be pasted together or must run separately;
- quote paths containing spaces;
- avoid assuming bash-only commands are available to the user.

Do not start a second web/API process when ports `3000`/`8000` are already occupied. Inspect the
listener first.

## Completion report

For a package, report:

- user journey changed;
- current-route files changed;
- legacy capability reused or frozen;
- backend/API/domain changes;
- Demo data changes;
- focused tests run during development;
- package/merge-gate validation;
- owner validation still required or completed;
- remaining known gaps;
- confirmation that locked authority, ftrack, and secret-safety boundaries remain intact.
