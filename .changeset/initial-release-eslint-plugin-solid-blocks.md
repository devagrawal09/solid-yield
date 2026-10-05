---
"eslint-plugin-solid-blocks": minor
---

Initial release: 18 ESLint rules for what solid-blocks' strict dialect checks and TypeScript cannot (reads only in holes, writes delegated to, no `throw` / `try` in blocks, the call form, bound events, foreign handoffs, …), with autofixes where one form is equivalent, and a flat `recommended` config (17 errors, `no-unshown-wait` a warning). The type-aware rules need `@typescript-eslint/parser`.
