# Native Docs: both acceptance halves pass (2026-10-10)

The documentation site (`examples/originals/docs`) is plain Solid 2. In native
mode its unchanged original is refused at the root, correctly. A minimal
author fix lowers, type-checks and runs as the original does.

- **Half A** (`native:docs:diagnostics`, `scripts/native-docs-check.mjs`,
  evidence `examples/harness/native-docs/expected-diagnostics.json`): lowering
  gives the Router boundary notice at `app.tsx:47:11`. The generated program
  has exactly one error: `[FOREIGN_HANDOFF]` at `main.tsx:3:15`, where `App`
  may fail with `ChunkError` and `URIError`. Both are real:
  - `SiteNav` and `SiteFooter` read `getSite()`, a server function, whose
    transport can fail;
  - `CommentList`'s `avatar()` decodes a URI component.

  Nothing above them handles either.
- **The author's fix** (`examples/harness/native-docs/author-fix.json`, applied
  at test time; the original stays byte-identical): one `Errored` around the
  site. `native:docs:typecheck` checks that the fixed copy type-checks.
- **Half B** (`examples/harness/native-docs/check.mjs`) compares three modes:
  the original, the fix as plain Solid, and the fix through native mode.
  - `native:docs:parity`: docs-yield's shared script, 24 states including the
    typed rate-limit, email, search and not-found failures.
  - `native:docs:ssr`: streamed SSR of `/`, `/docs/start` and `/docs/missing`.
    The resolved documents match, and `NotFound` is serialized.
  - `native:docs:hydrate`: `/` and `/docs/missing` keep their server nodes; the
    theme toggle after hydration and the not-found boundary match.

The comparisons ignore owner-tree ids (hydration keys, streaming placeholder
ids), as the dashboard's do.

Docs needed no compiler change of its own. Its route handoffs became acceptable
when F-S45 learned that `markSafeError` fails nothing.
