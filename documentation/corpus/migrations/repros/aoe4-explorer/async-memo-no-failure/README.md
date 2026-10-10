# async-memo-no-failure

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/async-memo-no-failure`

Input: `createMemo(() => compute(2))` where `async function compute(n) { return n * 2 }` cannot fail. Same file in `strict/` (`strict: true`) and `snc/` (`strictNullChecks: true` only).

Expected: No error in every config.

Actual: With the app's `strict: false`: `NoFailure.tsx:5:17 error TS2345: [generated] [FAILURE_CLASS] declare a failure class with class Boom extends Failure(` (a library-dialect message). With `strictNullChecks: true` (`strict/`, `snc/`): 0 errors. The checker silently depends on strictNullChecks; nothing in the install docs says so.
