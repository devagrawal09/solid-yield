---
"solid-blocks": minor
"eslint-plugin-solid-blocks": patch
---

`$dynamic` is removed (D-058, D-005). Every call site was `attempt(() => <server-component call>)` in the server-component twins, which are gone, and nothing else used it; the blocks model has no server components. A component chosen at run time is a `<Switch>` / `<Show>` over the components. `eslint-plugin-solid-blocks`: `no-foreign-reactive` still reports `dynamic` from `@solidjs/web`, now pointing to `<Switch>` / `<Show>`.
