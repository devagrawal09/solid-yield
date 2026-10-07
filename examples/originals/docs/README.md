# Field Notes: plain Solid 2 original

A content site using `solid-js` and `@solidjs/web` rc.13 and `@solidjs/router`.
Its yield twin is [docs-yield](../../docs-yield). The two apps have matching
markup, fake APIs, routes and widget behavior. No yield code is imported here.

```sh
pnpm -C examples/originals/docs dev
pnpm -C examples/originals/docs typecheck
```

The API is deterministic and runs in process; no external service is needed.
The `"use server"` content functions are the twin's C1 provenance declarations,
not an RPC deployment. `stream/` contains the matching SSR/hydration entries.


## C3c content levels

`DOCS_LEVEL=S|M|L` selects the same site's renderer/data set at build or dev
startup; the default is L. S has six docs articles; M adds four math/code blog
posts; L adds the 20-entry API reference and eight-release changelog. For example,
`DOCS_LEVEL=M pnpm build`. Restart the dev server after changing the level.

The common 40-step browsing script visits the enabled content types. Each
pipeline adapter carries an author-asserted `"use pure"` contract; this is not a
compiler proof of package purity. See
[the C3c measurement report](../../../documentation/compiler-c3c-scaling.md)
for the three-size results and the existing frame DOM-parity limits.
