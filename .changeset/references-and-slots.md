---
"solid-yield": minor
---

D-118, a reference is held, never read:

- **Event-handler props arrive as themselves.** A prop declared `Handler<…>` / `EventHandler<…>` is the `$event` in the child, not a path: call it `yield* props.onSave(x)` and bind it `onClick={yield* props.onSave}`, one `yield*` each. **Breaking:** the old `yield* (yield* props.onSave)(x)` is a type error. Such a prop takes an `$event` only (`[HANDLER_PROP]` for a source or a hole) and is required (`[OPTIONAL_HANDLER]`; an optional one is `Source<Handler<…> | undefined>`). A plain function prop and a handler inside an object prop or a context value are still read through their path. Fixed with it: an `$event` given to a component through `h` was called where the child read it (Solid's `h` turned it into a getter calling it).
- **State slots.** `createSlot<T, "Name">({ name })`, `yield* $slot(Slot)` (the provided value, raw, and the slot in the component's requirements: `render` refuses a root that still requires it) and `yield* $slot(Slot, { init: function* () { … } })` (a local value from a setup-time init routine when no provider is above). Bound with `Slot.provide({ value, children })`.
- **`compose(schema)`.** `yield* Schema.$store()` makes one store and one setter `$event` per part (`{ at, set, parts }`); `Schema.provide({ value, children })` provides each part's slot. A part is the convention for a child that owns a slice of a parent's store: a path to read and a handler to write (`Part<S>`). New types `Slot`, `Part`, `Composed`, `ComposedStore`, `ComposedState`, `ComposeEntry`.
- **Events are called by routine code or by the DOM.** Calling an `$event` directly with no routine running (a timer, a promise callback, plain or foreign code) is the development error `EVENT_OUTSIDE_RUN`; production is unchanged. An event called from an event joins its transaction (pinned; Solid's own behaviour).
