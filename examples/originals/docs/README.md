# Field Notes: plain Solid 2 original

A content site using `solid-js` and `@solidjs/web` rc.14 and `@solidjs/router`.
Its yield twin is [docs-yield](../../docs-yield). The two apps have matching
markup, fake APIs, routes and widget behavior. No yield code is imported here.

```sh
pnpm -C examples/originals/docs dev
pnpm -C examples/originals/docs typecheck
```

The API is deterministic and runs in process; no external service is needed.
The `"use server"` content functions are the twin's C1 provenance declarations,
not an RPC deployment. `stream/` contains the matching SSR/hydration entries.
