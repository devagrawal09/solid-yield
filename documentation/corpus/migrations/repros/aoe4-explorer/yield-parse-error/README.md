# yield-parse-error

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/yield-parse-error`

Input: Async-memo list shown through `<Show when={...} keyed>{(list) => <For each={list.slice(0, all() ? undefined : 2)}>` with a signal per row.

Expected: Lowers.

Actual: Standalone: generated TS errors (`ShowKeyedSlice.tsx:12:27 [GENERATED_TYPE]`, `TS2339 Property 'diff' does not exist on type 'Source<any...>'`, `[FAILURE_CLASS]`). In the app (PatchHistory.tsx, same shape) the lowering itself crashed: `[BABEL_PARSE_ERROR] Unexpected reserved word 'yield'. (40:90)` reported at 18:14.
