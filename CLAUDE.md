# CLAUDE.md

## Project

This repository implements the Intent Core Alignment System: an independent AI-assisted alignment product with ftrack as its first formal Workflow Connector.

## Required reading

Before changing code, read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/PRODUCT_SCOPE.md`
3. `docs/GLOSSARY.md`
4. `docs/ROLE_PERMISSIONS.md`
5. the relevant module or integration contract

Do not infer product rules from one file when a dedicated contract exists.

## Non-negotiable rules

- Agents must not call ftrack directly.
- All external production data must pass through the Connector and internal data model.
- Production Facts, AI Proposals, and Human Decisions must remain separate.
- Agents may create drafts and Assessments but cannot confirm Anchors, approve Versions, resolve Human Gates, or perform unapproved write-back.
- Primary Anchors are confirmed by VFX Supervisors.
- Secondary Execution Anchors are confirmed by CG Supervisors.
- Artists cannot modify either Anchor type.
- Confirmed records must be versioned; do not overwrite history.
- Permissions must be enforced in backend logic, not only in prompts or UI.
- Do not hard-code synthetic scenarios into product behaviour.
- Runtime Agent code must work without Claude Code being open.
- Do not expose or print secrets.

## Before implementation

For each task:

1. Restate the goal.
2. List the documents and contracts you read.
3. Identify affected modules.
4. Identify contract or migration risks.
5. Propose a bounded implementation plan.
6. Wait for human confirmation when the task changes shared contracts.

## Change boundaries

Do not change these without explicit approval:

- shared domain schemas;
- role permissions;
- Anchor authority;
- Agent input/output contracts;
- workflow states;
- ftrack mapping;
- write-back policy;
- public API contracts;
- core technology choices.

When a change is necessary, propose the documentation or Decision Record update first.

## Coding requirements

- Keep ftrack integration isolated from Agent logic.
- Use structured and validated Agent outputs.
- Record model and prompt version for Agent Runs.
- Preserve source links for Assessments and summaries.
- Use deterministic code for permissions, state transitions, and technical checks.
- Add tests for new behaviour.
- Handle failure, retry, duplicate events, and missing context where relevant.
- Follow existing naming from `docs/GLOSSARY.md`.

## Completion checklist

Before declaring a task complete:

- run formatting;
- run linting;
- run type checks;
- run relevant unit and integration tests;
- verify permission boundaries;
- verify no secrets or production data were added;
- update documentation if behaviour changed;
- summarise files changed and remaining risks.

## Git behaviour

- Work on the assigned feature branch.
- Do not make unrelated changes.
- Do not rewrite shared contracts silently.
- Keep commits and Pull Requests focused on one coherent task.
