---
"solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

Binding an event that may wait on a pending read no longer makes the view pending (D-075, amended): the runtime never suspends a view for a call. The handler's `P` is carried instead as a may-wait marker, a third view parameter `View<P, E, W>` (also `ComponentView`, `Component`, `HView`, `ChildView`; it defaults to `boolean`, so existing annotations accept either), folded by the new `MayWaitOf` / `ViewMayWait` and passed on by flow controls, boundaries, `h` and `lazy`. It is not a color: a may-wait view with `P = false` is settled and an element. `eslint-plugin-solid-blocks`: new `no-unshown-wait`, a warning in `recommended` that needs type information, reports a bound handler that may wait ("show its in-flight state").
