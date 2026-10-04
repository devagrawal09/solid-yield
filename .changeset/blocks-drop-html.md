---
"@solidjs/blocks": minor
---

The `html` tagged-template flavor is removed (D-046), and `h()` is the one no-JSX flavor. The removal covers the `@solidjs/blocks/html` entry point and its dist builds, the `@solidjs/html` peer and dev dependency, and the `html`-only hole types `HtmlValue` and `ComponentHole`. Both no-JSX twins use `h()` only, and no twin, fixture or doc example used `html`; it existed only in the package's own unit tests. A second no-JSX surface with no twin cannot be kept in parity with the first (D-005, D-012).
