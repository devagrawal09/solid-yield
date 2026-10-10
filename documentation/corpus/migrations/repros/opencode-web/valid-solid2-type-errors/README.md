# Seven valid Solid 2 files, 0 plain `tsc` errors, 10 checker errors

Commands: `./node_modules/.bin/solid-yield check .` and `./node_modules/.bin/tsc -p tsconfig.json` (tsc: 0 errors).
tsconfig adds `noUnusedLocals` (as opencode-web's).

| file | construct (all valid Solid 2) | checker |
| --- | --- | --- |
| a-writable-derived.tsx | `createSignal(() => props.initial)` (writable derived) | `4:48 [SUGAR_CALLBACK] Move this reactive read into JSX…` (with a module signal instead of a prop: TS2345 "Argument of type '() => …' is not assignable", i.e. the getter becomes the value) |
| b-no-initial.tsx | `createSignal<string>()` | `4:29 TS2554 Expected 1-2 arguments, but got 0` |
| c-primitive-for-item.tsx | `<For each={THEMES}>{(t) => t.charAt(0)…}` | `TS2339 Property 'charAt' / 'slice' does not exist on type 'Source<…>'`; under vite-plugin-solid-yield it is a run-time crash (`e.charAt is not a function`, opencode-web Settings) |
| d-effect-expression-body.tsx | `createEffect(() => n(), (v) => sink.push(v))` | `4:17 TS1345 [generated] An expression of type 'void' cannot be tested for truthiness` (expression body treated as a possible cleanup) |
| e-literal-argument.tsx | `prompt({ parts: [{ type: "text", text: text() }] })` | `6:9 TS2345 [generated] … type: string … not assignable to … "text"` (argument hoisted, literal widened); `9:7 CATCH_SWALLOWS` is expected (bare `return`) |
| f-prop-narrowing.tsx | `const info = props.info; info.role === "assistant" ? info.error…` | `6:45 TS2339 Property 'error' does not exist on type 'Msg'` + `3:17 GENERATED_TYPE` (each use re-reads the prop; narrowing is lost) |
| g-unused-catch-binding.tsx | `catch (e) { setMsg("failed") }` with `e` unused | `9:14 TS6133 'e' is declared but its value is never read` (the generated `const e = __nativeValue(_caught)`; tsc does not flag catch bindings) |

opencode-web hits: a/b Settings.tsx, c Settings.tsx theme options, d ChatView.tsx keys effect, e MessageInput.tsx prompt
parts, f MessageItem.tsx `info.error`/`tokens`, g Settings.tsx handleSave.
