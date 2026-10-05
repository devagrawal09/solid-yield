---
"solid-blocks": minor
---

A superseded `$memo` run is no longer closed at its pending `attempt` (D-080): it runs to completion and its result is discarded, exactly like Solid's async memo. Put no side effects after an await in a memo's body.
