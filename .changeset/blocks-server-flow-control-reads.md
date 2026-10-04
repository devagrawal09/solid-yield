---
"solid-blocks": patch
---

A flow control's own prop reads are no longer reported as the holding view's on the server. Solid's server `For` and `Show` read `each` and `when` synchronously as they are created, with no observer, while the holding view runs. In development, every named component that called a flow control in a hole therefore failed server rendering with a false `[READ_IN_VIEW]`; anonymous components were never checked. A flow control's creation now runs as its own, outside the holding view's top level. Client rendering and production builds were not affected. Found by the conformance harness (D-039, D-069 F7), which is now part of the package's tests (`test/conformance`, `pnpm run test:conformance`).
