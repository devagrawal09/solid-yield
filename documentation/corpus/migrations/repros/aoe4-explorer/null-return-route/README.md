# null-return-route

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/null-return-route`

Input: A redirect route component that returns `null`, listed in `createRouter({ routes })`.

Expected: Accepted (a component may render nothing).

Actual: `Routes.tsx:14:8 [SUGAR_COMPONENT] A sugar component needs a top-level PascalCase name.` here; in the app (routes defined in another module than the render) the same component gave `[SUGAR_ESCAPE] Routine CivsRedirect is handed to an unknown consumer`. Returning `<></>` is accepted.
