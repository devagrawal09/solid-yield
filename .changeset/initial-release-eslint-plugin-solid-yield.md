---
"eslint-plugin-solid-yield": minor
---

Initial release: 18 ESLint rules for what solid-yield's strict dialect checks and TypeScript cannot (reads only in holes, writes delegated to, no `throw` / `try` in routines, the call form, bound events, foreign handoffs, …), with autofixes where one form is equivalent, and a flat `recommended` config (17 errors, `no-unshown-wait` a warning). The type-aware rules need `@typescript-eslint/parser`.
