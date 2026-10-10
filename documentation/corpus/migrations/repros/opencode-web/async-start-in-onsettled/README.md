# Fire-and-forget async work started in onSettled: GENERATED_TYPE, then ASYNC_NOT_ALLOWED at run time

Commands: `./node_modules/.bin/solid-yield check .` then `node ../runtime-harness.mjs`

This is the Solid 1 `onMount(async …)` / `onMount(() => { void loop() })` pattern after the rename to `onSettled`,
which Solid 2's cheatsheet recommends for component-level setup.

Checker (1 error): `main.tsx:10:13 TS2345 [GENERATED_TYPE] Check this operation and the function containing it; the
generated code cannot accept it.` at `onSettled(` — nothing says that an effect may not wait, or that `void` does not
detach the promise.

Runtime: plain and plain-dev render `event 1event 2event 3`; yield and yield-dev render nothing and throw
`[ASYNC_NOT_ALLOWED] an async attempt suspends; only a $memo or an $event may wait (this is an effect).`
The lowering turns `void (async () => {…})()` into `void (yield* function* () {…}())`: the effect drives the loop
itself and waits on it. In opencode-web this was App's SSE reconnect loop and MessageInput's provider/agent loader;
both had to move (the loop into an unselected module, the loader into an async memo).
