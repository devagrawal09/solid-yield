# route-root-errored

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/route-root-errored`

Input: A route component with an async memo (fetch) rendered by `createRouter` whose render-prop child wraps `{r.children}` in `<Errored>` and `<Loading>`. `strict/` has the same file under `strict: true`.

Expected: Accepted: every route renders inside the root Errored/Loading (that is where the failure goes at runtime), as F-S43 already credits providers above the router.

Actual: `RootErrored.tsx:9:17 TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored ... Remaining: a transport failure (ChunkError) | any.` under `strict: false`, plus `[generated] [FAILURE_CLASS]`; `Remaining: TypeError | DOMException` under `strict: true`. ChunkError should only come from `"use server"` (sugar-design.md 'Native failure rules after review 3').
