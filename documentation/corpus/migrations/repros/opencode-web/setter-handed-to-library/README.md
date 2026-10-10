# Checker-clean: a signal setter handed to a package callback stops working in the yield *dev* build

Commands: `./node_modules/.bin/solid-yield check .` then `node ../runtime-harness.mjs`

`lib/ticker.ts` (outside the selection, like a package) calls its callback from its own timer.

Checker: `1 files, 0 errors`. Expected: every build shows a growing count.

Actual: plain, plain-dev and yield (prod) count up; **yield-dev stays at 0** and throws
`[SETTER_OUTSIDE_RUN] a $signal's setter called outside a routine … handed to plain code it writes nothing.`
The lowering wraps the setter as `nativeWrite(setTicks)` (documented: "the runtime checks the write where it runs"),
so the check moves from the checker to a development-only runtime throw, and production and development builds of
the same program behave differently. In opencode-web this is the virtualizer's `onChange: notify` called from
virtual-core's scroll/ResizeObserver handlers: in the yield dev build the message list stopped following scrolls
(2 virtual-flow checks failed, 11 SETTER_OUTSIDE_RUN page errors); the prod yield build was fine.
