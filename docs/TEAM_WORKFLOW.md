# TEAM_WORKFLOW.md

**Project:** Intent Core Alignment System  
**Purpose:** Define how the team collaborates while using multiple Claude Code sessions

## 1. Working model

One person acts as the **Architecture and Integration Owner** during project setup.

This owner is responsible for:

- maintaining shared project documents;
- approving changes to common contracts;
- creating the initial repository structure;
- validating the end-to-end integration path;
- preparing work packages before parallel development begins.

Other members join after the shared context, external dependencies, feasibility findings, and repository skeleton are stable enough to support parallel work.

## 2. Single source of truth

All members work from one GitHub repository.

Shared knowledge must live in the repository, not in personal Claude conversations.

Required shared files:

- `docs/PROJECT_CONTEXT.md`
- `docs/PRODUCT_SCOPE.md`
- `docs/GLOSSARY.md`
- `docs/ROLE_PERMISSIONS.md`
- `docs/API_AND_ACCOUNTS.md`
- `docs/TEAM_WORKFLOW.md`
- `CLAUDE.md`
- later architecture, integration, and Agent contract documents

## 3. Ownership structure

The team will assign owners for these areas:

- Architecture and shared contracts
- Backend and ftrack integration
- Runtime Agents and evaluation
- Frontend and interaction
- Research validation and scenario design

One person may own more than one area. Every shared contract must have one final reviewer.

## 4. Task lifecycle

Every implementation task follows this flow:

1. Create a GitHub Issue.
2. State the goal, relevant documents, allowed files, dependencies, and acceptance criteria.
3. Assign an owner.
4. Create a feature branch.
5. Ask Claude Code to read the required documents and propose an implementation plan.
6. Human owner reviews the plan.
7. Claude Code implements within the stated scope.
8. Run tests, linting, type checks, and manual verification.
9. Open a Pull Request.
10. Module owner reviews the change.
11. Architecture Owner reviews changes to shared contracts.
12. Merge only after acceptance criteria pass.
13. Update documentation when behaviour or contracts changed.

## 5. Branch and Pull Request rules

Suggested branch names:

- `feature/ftrack-initial-sync`
- `feature/core-anchor`
- `feature/artist-task-context`
- `feature/human-gate-ui`
- `fix/version-event-deduplication`
- `docs/update-role-permissions`

Rules:

- Do not work directly on the main branch.
- Keep one coherent task per branch.
- Do not mix contract changes with unrelated UI work.
- Do not merge code that depends on undocumented fields or permissions.
- Pull Requests must describe what changed, why, how it was tested, and whether shared contracts changed.

## 6. Contract-change process

The following cannot be changed inside a feature branch without review:

- shared domain objects;
- Anchor meaning or authority;
- Agent input/output contracts;
- role permissions;
- workflow states;
- ftrack entity mapping;
- write-back policy;
- cross-module API contracts.

Process:

1. Open a contract-change Issue.
2. Explain the current problem and proposed change.
3. Update the relevant document or Decision Record.
4. Obtain Architecture Owner approval.
5. Implement affected backend, frontend, Agent, and test changes together.

## 7. Claude Code usage

Each Claude Code task must specify:

- goal;
- required reading;
- allowed scope;
- forbidden changes;
- acceptance criteria;
- required tests.

Claude Code must not be asked to “build the whole Agent” without a bounded contract.

Different Claude Code sessions must not invent separate schemas or permissions.

## 8. Shared versus private material

Commit to Git:

- project documents;
- `CLAUDE.md`;
- `.env.example`;
- shared Claude project settings;
- API contracts;
- test fixtures without sensitive data;
- evaluation scenarios marked as synthetic.

Do not commit:

- `.env`;
- API keys;
- ftrack credentials;
- personal access tokens;
- private production files;
- personal Claude memory;
- local database files.

## 9. Integration discipline

Parallel modules must connect through shared contracts.

A working end-to-end path must be maintained:

```text
ftrack or controlled input
→ internal production object
→ Anchor context
→ Agent Assessment
→ Human Gate / Decision
→ controlled write-back
```

New work must not break this path.

## 10. Definition of done

A task is done only when:

- acceptance criteria pass;
- tests are included;
- permission rules are enforced by the backend;
- AI output is separated from human decisions;
- no secrets or hard-coded demo logic are introduced;
- relevant documentation is updated;
- the change works with the shared internal data model.
