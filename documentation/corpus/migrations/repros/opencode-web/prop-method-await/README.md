# `await props.x.method()` in an async event handler: the await and the call's failure disappear

Command: `./node_modules/.bin/solid-yield check .`

Expected: `NoCatch` and `SignalHeld` report `EVENT_REJECTS` (unknown: an opaque SDK call rejects);
`Nullable` and `LocalCopy` are clean (the rejection is caught and handled by a state write).

Actual:
- `NoCatch.tsx:9:17 TS2339 Property 'data' does not exist on type 'Promise<…>'` + related "Did you forget to use 'await'?"
  The generated handler is `const res = (yield* props.api.session.create)({ body: {} })`: the `await` is dropped
  and the call is not wrapped in `attempt`, so **no EVENT_REJECTS** (false negative). The author did write `await`.
- `Nullable.tsx:10:30 [SUGAR_READ_ARGS] A source read takes no arguments.` (refusal; blocks the Vite build)
- `LocalCopy.tsx:10:30 TS2488 Type '(opts…) => Promise<…>' must have a '[Symbol.iterator]()' method` and
  `LocalCopy.tsx:16:27 [EVENT_REJECTS] This handler can fail with unknown and nothing catches it` (false positive: it is caught)
- `SignalHeld.tsx` (control): correctly lowered to `yield* __nativeAttempt(() => client.session.create(…), …)` and
  reports `SignalHeld.tsx:18:27 [EVENT_REJECTS] … unknown` as expected.

opencode-web: SessionList.tsx:27 (create), :46 (messages), :69 (update), :92/:104/:116 (fork), :134 (delete)
and MessageInput.tsx handleSend all call the SDK through `props.api`.
