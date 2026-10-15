---
"solid-yield": minor
---

D-126: props and context values are given as they are. "The only things going through props are reactive values and events; everything else is a bag of those two things."

- **A prop is no longer always a path.** A reactive one — declared `Source<T, E, P>`, passed a source, a path or a hole — is a path, read with `yield*` as before. An `$event` handler is the handler itself: call it `yield* props.onSave(x)`, bind it `onClick={yield* props.onSave}`. Any other declared type is held: the child gets the value the caller passed, a bag's leaves as they were put there. **Breaking:** a bare-typed prop is no longer a settled source. `yield* props.label` on `label: string` is a type error (read `props.label`); a source, a path or a hole passed to it is refused, `[HELD_PROP]` (declare it `Source<T>`); a plain value passed to a reactive prop is refused, `[REACTIVE_PROP]` (pass `constant(v)`); `[SETTLED_PROP]` is folded into `[REACTIVE_PROP]`; a handler prop takes an `$event` only, `[HANDLER_PROP]`. The old `yield* (yield* props.onSave)(x)` is a type error. An optional prop left out is `undefined`.
- **A context's value follows the same rule.** `yield* Ctx` gives a context of sources as a path and any other context's value as it is: a handler in a context is called `yield* save(x)`. `provide`'s `value` takes what a prop of the context's type takes.
- **`h`** hands a component's function-valued props over unread. Fixed with it: an `$event` given to a component through `h` was called where the child read it.
- **Events are called by routine code or by the DOM.** Calling an `$event` directly with no routine running (a timer, a promise callback, plain or foreign code) is the development error `EVENT_OUTSIDE_RUN`; production is unchanged. An event called from an event joins its transaction (pinned; Solid's own behaviour).
