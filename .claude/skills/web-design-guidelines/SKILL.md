---
name: web-design-guidelines
description: Review UI code (accessibility, forms, animation, typography, content handling, performance, navigation/state, touch, dark mode, i18n, hydration) against Vercel's Web Interface Guidelines. Use when asked to review UI, check accessibility, audit design, or check code against best practices.
source: https://github.com/vercel-labs/agent-skills (skills/web-design-guidelines) — ruleset fetched from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
installed: manually, 2026-08-09 — the official `npx skills add` CLI requires Node >=22.20, this environment has Node v20.10.0, so the CLI could not run. The ruleset below was fetched directly and is applied by reading it and cross-referencing target files, in place of the CLI-driven flow.
---

Fetch the latest rules from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md before a review when live network access is available (rules may have been updated since this snapshot). Otherwise use the snapshot in RULES.md in this directory.

Process: examine the specified files/pages, cross-reference against the ruleset, report findings in `file:line` format, terse, grouped by file. Note any rule that's structurally inapplicable to this codebase (e.g. no client routing state to reflect in a URL) rather than forcing a finding.
