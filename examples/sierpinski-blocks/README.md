# Sierpinski — `@solidjs/blocks` twin

[`examples/sierpinski`](../sierpinski) written with `@solidjs/blocks` (JSX flavor) on stock Solid 2: same markup, timing and behavior. The original stays as the baseline.

What the library's rules change in the source:

- **Setup creates, holes read.** A triangle chooses its structure from its position props. The original destructures `props` in the component body; here a setup does not read (D-042) and a view does not branch (D-032), so the leaf-or-branch choice is a `<Switch>` over holes and the children's positions are read in the holes that create them (the props never change: each runs once). The slow children's memo is `lazy`: a leaf never starts the idle-time work.
- **Pending travels with the view.** The branch memos wait for an idle callback, so a triangle may be pending (`Component<TriangleProps, true, never>`, spelled out because the component is recursive). A view that reads a pending child is pending too, so the container markup moved into `Container` and the boundary receives it as a pending view: `<Loading fallback="Loading...">{Container({ scale, seconds })}</Loading>`.
- **Events are `$event`s**, the timer and frame callbacks included.
- The idle-callback cleanup stays a plain `onCleanup` inside the `attempt` thunk (it runs under the memo).

The seconds passed down the recursion are pending and may fail, so `TriangleProps` declares them: `children: Source<number, IdleError, true>` (D-068). That is why the leaf renders its dot with `{yield* Dot(…)}`.

```bash
pnpm test         # behavior (6) + differential parity against examples/sierpinski (1)
pnpm typecheck    # stock tsc
pnpm lint         # @solidjs/eslint-plugin-blocks + no explicit any
pnpm build
node ../../scripts/example-blocks/browser.mjs sierpinski   # Chromium, original vs twin
```
