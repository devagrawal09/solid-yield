# Checker-clean async handler: writes before the await are held under vite-plugin-solid-yield (strict-subset violation)

Commands: `./node_modules/.bin/solid-yield check .` then `node ../runtime-harness.mjs`

Checker: `solid-yield check: 1 files, 0 errors`.

Expected (plain Solid 2, and the claim that checker-clean code behaves the same through the plugin):
`{"during":{"label":"sending","draft":"","disabled":true},"sentAfterTwoClicks":"1"}` for all four builds.

Actual:
- plain, plain-dev: `{"during":{"label":"sending","draft":"","disabled":true},"sentAfterTwoClicks":"1"}`
- yield, yield-dev: `{"during":{"label":"send","draft":"hello","disabled":false},"sentAfterTwoClicks":"2"}`

The native lowering turns the plain async handler into a `$event`, which is one transaction (D-081): `setSending(true)`
and `setDraft("")` are held until the handler settles, so the pending UI never shows and the `sending()` guard lets a
second click through. Plain Solid 2 only holds writes inside `action(...)`. D-081 documents this for the library dialect;
native mode lowers code that never asked for a transaction. In opencode-web this is MessageInput.handleSend: under the
yield build the textarea is not cleared or disabled while a prompt is in flight, and a second Enter sends the prompt twice
(two POSTs, measured; plain Solid 2 sends one).
