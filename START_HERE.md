# START_HERE.md

## Repository setup checklist

- [ ] Create one shared GitHub repository.
- [ ] Upload this repository skeleton.
- [ ] Protect the main branch.
- [ ] Add team members.
- [ ] Confirm one Architecture and Integration Owner.
- [ ] Confirm that all members can clone the repository.
- [ ] Confirm that Claude Code reads the same root `CLAUDE.md`.
- [ ] Do not add real API keys.
- [ ] Create the first Issue: `Initial engineering skeleton`.
- [ ] Review the proposed framework-init plan before Claude Code generates code.

## First Claude Code task

Ask Claude Code to:

1. read all required project documents;
2. inspect the repository structure;
3. propose the exact initialisation plan for:
   - Next.js web app;
   - FastAPI backend;
   - PostgreSQL;
   - Redis/background worker;
   - shared contracts;
   - Docker Compose;
   - linting and tests;
4. identify any conflict with the current documents;
5. make no code changes until the plan is approved.
