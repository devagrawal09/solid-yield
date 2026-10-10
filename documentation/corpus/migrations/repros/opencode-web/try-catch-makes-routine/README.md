# A try/catch alone turns a plain (non-reactive) function into a routine

Command: `./node_modules/.bin/solid-yield check .`

Expected: 0 errors. None of these functions reads, writes or creates reactive state.

Actual (3 errors):
- `A.tsx:13:30 [SUGAR_ESCAPE] Routine parseStored is handed to an unknown consumer; a plain callback cannot drive it.`
- `B.ts:8:37 [SUGAR_ESCAPE] Routine safeUpper is handed to an unknown consumer` (a `.ts` file, `Array.map`)
- `C.tsx:1:1 [generated] [SUGAR_CALLBACK] Move this reactive read into JSX, a memo, an effect, or an event.` (no reactive read exists; position is the file start)

In opencode-web the same bug produced `Markdown.tsx:1:1 [SUGAR_CALLBACK]` (Prism highlight callback with try/catch)
and `config.ts:46:57 TS2769 [STREAM_IN_EVENT] a stream is consumed in a reactive routine: $memo or $projection`
(module-level `createSignal(loadConfig())`, where `loadConfig` only parses localStorage inside a try/catch).
Without the try/catch every case is clean.
