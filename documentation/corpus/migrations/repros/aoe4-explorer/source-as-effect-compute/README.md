# source-as-effect-compute

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/source-as-effect-compute`

Input: `createEffect(count, (n) => ...)` - a signal getter passed directly as the compute phase (it ignores the `prev`
argument Solid passes). `ArrowControl.tsx` wraps it as `() => count()`.

Expected: accepted (valid and typed in Solid 2: `ComputeFunction<Prev, T>`; the arrow form is equivalent).

Actual: `Counter.tsx:5:16 error TS2345: [GENERATED_TYPE] Check this operation and the function containing it; the
generated code cannot accept it.` In the app the same shape with a memo (`createEffect(current, ...)` in QuickNav.tsx)
was a transform refusal instead: `QuickNav.tsx:15:13 [SUGAR_READ_ARGS] A source read takes no arguments.` (reported at
the component name). Sites: QuickNav `current`, Search `results`, App/index `activePage`, usePageMeta `meta`.
