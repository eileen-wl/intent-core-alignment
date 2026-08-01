# ICAS Step 7B-1 — Shared Design Foundation Implementation Brief

**Status:** Ready for implementation  
**Branch:** `feat/step7-role-aware-dashboard`  
**Scope:** Shared frontend design foundation only

---

## 1. Objective

Build the reusable visual and layout foundation for the new role-aware ICAS product experience.

This batch must not implement the full VFX, CG, or Artist workspaces.

It must create:

- design tokens;
- global visual reset and typography hierarchy;
- reusable layout primitives;
- reusable status and authority components;
- shared loading, empty, failure, and permission states;
- a Development-only component preview page.

The existing smoke-test pages must continue to work.

---

## 2. Required inspection before coding

Inspect:

- current Next.js app structure;
- current global CSS;
- existing tests;
- current component conventions;
- existing dependencies;
- current App Router routes;
- whether a styling library already exists.

Prefer existing dependencies and plain CSS / CSS Modules where sufficient.

Do not add a large UI framework unless the repository already uses it.

---

## 3. Allowed implementation scope

### Design tokens

Define tokens for:

- neutral surfaces;
- text hierarchy;
- violet Agent accent;
- blue/teal production-fact accent;
- amber attention;
- red blocking error;
- grey history;
- green technical success;
- spacing;
- radius;
- border;
- shadow;
- typography;
- content widths.

### Layout primitives

Create reusable primitives for:

- page container;
- reading column;
- comparison grid;
- stack;
- inline row;
- section spacing;
- panel;
- card;
- divider.

### Shared components

Create:

- `PageHeader`
- `SectionHeader`
- `SummaryCard`
- `StatusBadge`
- `AuthorityLabel`
- `MetadataRow`
- `EmptyState`
- `ErrorState`
- `PermissionState`
- `LoadingSkeleton`

### Authority labels

Support:

- Production fact
- Human intent
- Human-confirmed
- AI interpretation
- AI proposal
- Intent Signal
- Human review required
- Open question
- Historical
- Integration-ready
- Read-only for your role

### Development preview

Add a Development-only route such as:

```text
/dev/ui-foundation
```

The page should show:

- typography hierarchy;
- colours and semantic labels;
- cards and panels;
- status badges;
- authority labels;
- empty, loading, error, and permission states;
- responsive layout examples.

It must be clearly marked as a Development preview and must not appear in the portfolio-facing navigation.

---

## 4. Existing page policy

Do not:

- remove legacy `/shots` pages;
- remove Role or Actor ID controls yet;
- redesign the full root page;
- create `/demo`, `/vfx`, `/cg`, or `/artist` yet;
- modify backend APIs;
- change Agent behaviour;
- change Anchor authority;
- add ftrack sync;
- add new database models.

A minimal link to the Development preview from an existing Development surface is acceptable only if clearly isolated.

---

## 5. Accessibility and interaction

Components must support:

- keyboard focus visibility;
- semantic headings;
- sufficient colour contrast;
- labels that do not rely on colour alone;
- reduced-motion-safe behaviour;
- responsive desktop-to-tablet behaviour.

No animation system is required.

---

## 6. Tests

Add focused frontend tests for:

- AuthorityLabel variants;
- StatusBadge variants;
- EmptyState;
- ErrorState;
- PermissionState;
- Development preview route;
- key accessibility labels where practical.

Run:

- focused tests;
- full frontend tests;
- TypeScript;
- ESLint;
- Prettier;
- Next.js production build.

---

## 7. Acceptance criteria

The batch is complete when:

1. shared tokens exist and are used by the new components;
2. visual hierarchy is clearly improved over browser defaults;
3. all required shared components exist;
4. authority types are visibly distinguishable without relying only on colour;
5. Development preview demonstrates every component and state;
6. legacy smoke-test pages still work;
7. no role workspace or Demo flow is implemented prematurely;
8. no backend or Step 8 code changes occur;
9. all tests and production build pass;
10. documentation records what was added and what remains for 7B-2.
