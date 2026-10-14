---
"solid-yield": minor
"eslint-plugin-solid-yield": patch
---

Lenses, lens props, state slots and `compose` (D-125, D-126; proposed). `$store` and `$optimisticStore` give a `Lens<S>`: the same `[path, setter]` pair, branded. `focus(lens, "key")` gives a lens on one part of the store. Its writes go through the parent's setter, and its receipt gives the focused part. A prop declared `Lens<S>` is given as it is, not as a path (amends D-042). `createSlot<S, "Name">({ name })` makes a slot, a required context whose value is a lens. `yield* $slot(Slot)` gives the bound lens and adds the slot to the component's requirements. `yield* $slot(Slot, { init })` requires nothing and makes a local store when no provider binds the slot. `compose(schema)` makes one container store from a schema of modules, with `$store()`, `lenses(lens)`, `provide({ value, children })` and `init()`. New development errors: `NOT_A_LENS`, `SLOT_READ`. The lint treats `$slot`'s setter and path as a store's.
