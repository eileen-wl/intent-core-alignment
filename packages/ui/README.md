# Shared UI

Reserved for reusable frontend components once the Dashboard is initialised.

Wired into the pnpm workspace as `@intent-core/ui` with a single
placeholder export so `apps/web` can depend on it and the package
typechecks from day one. No product components exist yet — add them
once role-aware Dashboard views (`docs/PRODUCT_SCOPE.md` §13) are
designed.
