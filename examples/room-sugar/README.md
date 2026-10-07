# Room sugar source design

This is the second, harder surface example for [sugar-design.md](../../documentation/sugar-design.md), rewritten from room-yield. It is not a runnable or parity-verified workspace package.

The UI routines in app, Document, identity, status-pill and routes/live use `"use yield"` and plain functions. The re-exported unmarked server I/O modules retain async iterable producers; those are not UI routines.

Open sites:

- `components/status-pill.tsx`: `watch` installs a foreign transport callback that calls an event. It must keep ordinary callback execution, not return a generator (F-S1).
- `components/status-pill.tsx`: `const deaths = props.wire.deaths` aliases a source. The prototype currently interprets path values as reads; use analysis or a source-reference form is needed (F-S4).
- `routes/live.tsx`: Errored has both plain accessor and setup/row-style fallbacks. Arity alone cannot recover the intended form (F-S4).
- `routes.ts` and `lib/sources.ts`: router/lazy/remote-stream boundaries need project-wide summaries and the real Vite build graph (F-S6).

No runtime, type, or lint rule was relaxed to call this second example passing. Todos is the checked transform target.
