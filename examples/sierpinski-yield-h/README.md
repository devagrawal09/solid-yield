# Sierpinski — `solid-yield` twin, no-JSX flavor (`h`)

[`examples/sierpinski`](../sierpinski) written with `solid-yield` and `solid-yield/h`: no JSX in the app (`src/app.ts`), no JSX transform involved in the views. The JSX-flavor twin is [`sierpinski-yield`](../sierpinski-yield); the setups follow the same rules (a setup does not read: positions are lazy memos over the props and the leaf-or-branch choice a `Show` over a hole; timer / frame callbacks are `$event`s).

What changes in the no-JSX flavor:

- Every dynamic value is a hole: the container's `style` and the dot's `style` and label are `$(function* () { … })` routines. The view generators never read, so each runs once.
- Components are given to `h` (`h(Triangle, { x, y, s, children: slowChildren })`) and created where the output is materialized; a branch returns the fragment `h([a, b, c])`.
- The pending coloring flows through `h`: a triangle's output is pending (its branches read an async memo), so `TriangleDemo` must wrap the container in `h(Loading, …)` — without it `render(TriangleDemo, …)` is a type error.

`TriangleProps` is the JSX twin's: `children: Source<number, IdleError, true>`. `h(Component, { children })` checks it like any prop.

```bash
pnpm test         # behavior (6) + parity against examples/sierpinski (1)
pnpm typecheck && pnpm lint && pnpm build
node ../../scripts/example-blocks/browser.mjs sierpinski --twin -blocks-h   # after building both
```

Client bundle (min / gz): original 40,576 / 15,761 B; JSX twin 46,382 / 17,911 B; this twin 60,685 / 22,803 B (it ships `@solidjs/h` and builds its DOM at runtime instead of from compiled templates).
