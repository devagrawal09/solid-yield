---
"eslint-plugin-solid-blocks": minor
---

Three new rules for the call form (D-062, D-065, D-066, D-067), each with an autofix. All three are errors in `recommended`, which they join together with the types that refuse block component tags.

- `no-component-tag`: a JSX tag naming a block component (a `$component`, a `lazy` component, or the library's flow controls and boundaries) is an error. The component is called instead, `{yield* Card({ todo })}`, so its colors reach the view; DOM elements and foreign plain-Solid components stay tags. The fix rewrites the tag as the call. Attributes become props: a `yield* src` becomes `src`, a derived read becomes a `function*` hole, and other values stay as they are. Children become a lazy view `function* () { return <…/>; }`, and a render arrow becomes a row generator wrapped in `view`. A tag given as a prop (`fallback={<Checkout />}`) becomes a lazy view too, so the component is still set up only when the prop is shown. Outside a generator (a root, a test) the tag becomes the plain call, with no `yield*`.
- `no-read-in-prop`: a `yield*` in a component call's argument object reads in the caller's hole, which would re-create the component on every change. The fix passes the source, or a hole.
- `component-children-generator`: a component call's `children` must be a generator. Plain JSX, a getter, a render arrow, and in JSX files `() => View()` are each rewritten as a lazy view or a row.

Block components are recognized by the component brand on their type when type information is available, and otherwise syntactically. The block rules now read a zero-arity `children:` or `fallback:` generator in a component call as a lazy view rather than a row, so `no-read-in-view-body` checks its body, `jsx-only-in-view` allows its JSX, and `prefer-view-wrapper` leaves it unwrapped (the call types it). A `children:` generator with parameters is still a row.
