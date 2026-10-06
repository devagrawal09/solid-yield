---
"solid-yield": patch
---

A component whose view's root element is a `<form>` or a `<select>` can be called in a hole (`{yield* Editor()}`). Both have an indexed getter, so WebIDL makes them iterable over their controls, and the hole's `perform` took any object with a `Symbol.iterator` for a routine operation: it drove the element, its first control reached the driver as an "operation", and the app halted with `[REACTIVITY_HALTED] … [NOT_AN_OPERATION]`. An operation is now recognised by what its iterator gives — a generator (`next`, `throw` and `return`) — and any other iterable in a hole is content. `NOT_AN_OPERATION` now says what it received (`It received: HTMLInputElement.`) and that a `yield*` of an iterable that is not an operation delegates to its items.
