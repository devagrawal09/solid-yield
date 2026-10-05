---
"solid-blocks": minor
---

Typed failures are branded at run time in every build (D-087). `raise` and an `attempt` handler's returned `Error` mark the failure with one non-enumerable symbol; before, only development builds told a typed failure from a crash. An `attempt` over an event call now hands its handler only those: a plain `throw` or a `TypeError` inside the called event is a bug, not a failure, and goes past the handler — `UNTYPED_THROW` in development, the original error in production — to the caller, or the nearest `Errored`. The handler's parameter type (the call's failures) is now exact.
