---
"solid-blocks": minor
---

A bound event's failure routes to the bind site (D-085). `onClick={yield* save}` (and an `on…` attribute given to `h`) binds the handler through a wrapper, one per bind, that records where it is bound: a DOM call's failure, which nobody handles, goes to the nearest `Errored` above the bind site — the view whose type already carries it (D-072) — and with none there the call's promise rejects. Before, it went to the `Errored` above where the handler was created, so a handler passed through props or context and bound under its own `Errored` failed past it. A call from block code (`yield* save()`, an `attempt` over it) still fails at its caller, and an unbound call (`save()`) that nobody handles rejects.
