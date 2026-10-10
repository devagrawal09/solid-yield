# ref-variable-lowering

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/ref-variable-lowering`

Input: `FocusReset.tsx` - the documented Solid ref form, `let el; ... <div ref={el}>`, with `el` used later in an effect
phase. `NamedEffect.tsx` - `createEffect(() => title(), applyTitle)` with a named plain function as the effect phase.

Expected: accepted, or a refusal that names the ref / the effect function.

Actual (checker): `FocusReset.tsx:3:17` three `[generated]` errors at the component name: `TS2488 Type 'never' must have a
'[Symbol.iterator]()'`, `TS2722 Cannot invoke an object which is possibly 'undefined'`, `TS2349 This expression is not
callable. Type 'HTMLDivElement' has no call signatures.` Nothing mentions `ref`. `NamedEffect.tsx:8:31 TS2345
[GENERATED_TYPE] Check this operation and the function containing it` (right place, generic message).

Actual (vite-plugin-solid-yield runtime): both are mis-lowered, so the errors are real but unexplained. The ref becomes
`ref={__nativeCallback($event(function* (...args) { return el(...args); }))}` - the element variable is *called*
(`TypeError: resetFocusEl is not a function`, `aboutEl is not a function` in the app), nothing ever assigns `el`, and the
bundler then dead-code-eliminates `if (el) el.focus()` to `function* () {}`. The named effect phase is passed as-is to
`$effect`, which drives it as a generator: `TypeError: Cannot read properties of undefined (reading 'next')` at `drive`,
`REACTIVITY_HALTED`. In the app every page rendered the App `Errored` fallback ("Problem while loading page").

Controls (`control/`, 0 errors): `ref={(e) => (el = e)}` and an effect phase `(t) => { applyTitle(t); }`. The expression-body
form `(t) => applyTitle(t)` (valid: returns `undefined`, i.e. no cleanup) gives yet another unrelated message:
`TS1345: [generated] An expression of type 'void' cannot be tested for truthiness.` at the component name.
