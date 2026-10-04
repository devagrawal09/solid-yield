---
"solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

An event attribute takes only a bound block event handler (D-072): `onClick={yield* save}`. An unbound `$event` handler, a plain function or a value read from a source there is a type error (the vendored JSX namespace's `EventHandlerUnion` is `Bound<…>`; in `h`, a plain function is refused). `Errored`'s `reset` is typed `Reset`, already bound and colorless. `Errored`'s fallback carries its colors to the boundaries above (a lazy view's; a row fallback `function* (error: Path<E>, reset: Reset)` is typed, its parameters annotated). `no-unbound-event` is in `recommended` as an error.
