`createSignal<T>()` with no initial value (a declared Solid 2 rc.13 overload) is rejected by the generated `$signal` call.
Command: `ln -sfn /home/user/migrations/solid-realworld/node_modules node_modules; ./node_modules/.bin/solid-yield check .` (plain `tsc --noEmit -p .` passes).
Expected: 0 errors. Actual: `src/App.tsx:5:27 error TS2554: Expected 1-2 arguments, but got 0.` — an untagged TypeScript arity error at the authored call, so it reads like a Solid typing error rather than a lowering gap. Workaround: `createSignal<string | undefined>(undefined)`.
