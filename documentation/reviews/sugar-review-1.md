# solid-yield sugar/native mode: a newcomer's review

Repo: `/private/tmp/sy-review` (detached at `proto/sugar-ls`, `d88e31c`). App: `/private/tmp/sy-review-out/myapp`.
Probe scripts: `chk.sh`, `v.sh`, `tsprobe.cjs`. The 12+ variants are in `variants/`.
Nothing tracked was modified (`git status` clean after the harness runs).

Framing note. The root README never mentions native mode. It presents only the strict `function*` / `yield*` dialect.
"Plain Solid 2 + Vite plugin + TS plugin" is only discoverable from `packages/ts-plugin-yield/README.md` ("Install and select files").
`sugar-design.md` then calls the directive-sugar sections "historical". A newcomer reading the root README first would conclude they must rewrite their app with `yield*`.

---

## Step 1. Setup for a new plain Solid 2 app

**Expected:** copy README deps, add the two plugins, run the CLI.
**Happened:**

1. Following the README literally with `file:` deps (my first attempt) **failed** at `pnpm install`:
   `[ERR_PNPM_WORKSPACE_PKG_NOT_FOUND] In : "vite-plugin-solid-yield@workspace:*" is in the dependencies but no package named "vite-plugin-solid-yield" is present in the workspace — This error happened while installing the dependencies of ts-plugin-solid-yield@0.0.0`
   - The ts-plugin README suggests `pnpm add -D ts-plugin-solid-yield@workspace:*`, which only works inside the monorepo, not in an app "next to the clone".
   - The README's own advice (`file:` copies) doesn't work for the TS plugin because its deps are `workspace:*`.
   - Fix I found myself: `link:` instead of `file:` for the ts plugin.
2. With the TS plugin as `link:` and the other three as `file:`, `solid-yield check .` worked. **`vite build` then failed:**
   `Cannot find module '.../node_modules/compiler-yield/src/failure-inference.js' imported from .../vite-plugin-solid-yield/src/native.js`
   - Cause: `native.js` imports `../../compiler-yield/src/...` by relative path out of the package, so a `file:` copy can't work.
   - Fix: `link:` for everything. The README's "pnpm copies a `file:` dependency… use `link:`" paragraph is correct in spirit, but native mode makes `link:` *mandatory*, and nothing says so.
3. The Vite config needs `solidYield({ mode: "native", include: ["src/**"] })`. The Vite README's "Use" section shows only `solidYield()` (strict dialect). `mode`/`include` are documented only in the TS-plugin README (and in `sugar-design.md`, whose older prose still shows an `include(file)` predicate form).
4. The README tsconfig says `"jsxImportSource": "solid-yield"` + `jsxFactory`. For native mode the example corpus uses `"@solidjs/web"`, and the TS plugin README never gives a full native tsconfig. I guessed `@solidjs/web` from `examples/originals/todos/tsconfig.json` and it worked.
5. The **root README's ESLint config doesn't apply to native code.** Running it on my plain Solid app gives
   `` `createSignal` from "solid-js" is reactive state routines cannot see: routines read and write only with `yield*`. Use `$signal` `` (error) and a warning demanding `jsxFactory`. See the lint section below.

**Result:** after about 5 failed or confusing steps and about 5 minutes of reading `native.js` and the example tsconfig, I got both the Vite native build (`vite build`: 81 modules, OK; vitest/jsdom smoke render: 2 `<li>` rendered, OK) and `pnpm exec solid-yield check .` working.

**Stuck-points / what I had to read:** the pnpm error text, `native.js` imports, `examples/originals/todos/{tsconfig,vite.config}`, and the TS plugin README.

Final working `package.json` deps: `link:` for `solid-yield`, `vite-plugin-solid-yield`, `eslint-plugin-solid-yield` and `ts-plugin-solid-yield`; Solid and Vite as in the README.

---

## Step 2. First CLI run and diagnostics

My plain app (counter, `createMemo(() => fetchItems())` list, context, `Loading` + `Errored`) → `solid-yield check: 3 files, 0 errors`.

A bug I introduced as a Solid dev (`item().name` inside the default `<For>` callback) was **caught by `tsc` but NOT by the CLI**:
`src/App.tsx(17,41): error TS2349: This expression is not callable. Type 'Item' has no call signatures.`
The CLI printed `3 files, 0 errors` for the same file. The CLI does print ordinary TS errors elsewhere (e.g. `t.ts:1:14 error TS2322` on an unrelated file), so something in the lowered code hid this one. This is a **false negative** in the tool whose job is to be the type check.

Removing each boundary in turn (the intended "color" diagnostics):

| Removal | Diagnostic (verbatim) | Reaction |
|---|---|---|
| `Loading` | `src/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.` | Understandable ("wrap it in Loading"), but the location is the `render(() => <App/>)` line, not the `items()` read. The "pending true; fails none; may-wait false" prefix is calculus vocabulary. |
| context provider | `index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.` | Good, names `ThemeCtx`. Again at the root, not the reader. |
| `Errored` | `index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown \| global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch` | The fix is clear; "FOREIGN_HANDOFF", "unknown \| global:Error" are opaque. It doesn't say *where* the `Error` comes from (`fetchItems`). |

Do the suggested fixes work? Yes: wrapping in `Loading`/provider/`Errored` brings it back to 0 errors (that's my base app). The "can't tell me where" problem is the main usability gap: a Solid dev wants the diagnostic at `createMemo(() => fetchItems())`, not at render.

---

## Step 3. Twelve mistakes

Score: 0 = missed or misleading, 1 = caught but unhelpful or wrong place, 2 = caught, right line, actionable.
Tools: CLI = `solid-yield check`, TSC = plain `tsc`. Lint was not a viable tool here (see below).

| # | Mistake | Caught? | Message (verbatim) | Line | Score |
|---|---|---|---|---|---|
| 1 | read `count()` at setup | CLI | `App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.` (+ a second root error: `[FOREIGN_HANDOFF] … fails any; … requires any; not handled`) | right (8:20 is exactly the `count()`) | 1 (message is the library's strict-dialect language: "A setup creates". And in real Solid reading at setup is legal, just non-reactive. The cascade `fails any / requires any` at the root is noise.) |
| 2 | forgot to provide a 2nd context | CLI | `index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: … requires UserCtx; The root requires a context; provide it above the component that reads it.` | root only | 1 (names the context, doesn't say who reads it) |
| 3a | `throw 'too big'` in a component body | CLI | `App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.` | wrong (the function name, not the throw) | 0 (misleading: says nothing about throwing a string) |
| 3b | `throw 'too big'` inside a memo | CLI | `index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: … fails unknown; … not handled — wrap in Errored or handle with attempt/catch` | root | 1 (`fails unknown` hints at the string; no mention that a string is not an Error) |
| 3c | `throw new Error` inside onClick | CLI | `[FOREIGN_HANDOFF] … fails global:Error; … not handled — wrap in Errored or handle with attempt/catch` | root | 0 (advice is wrong: in Solid, `Errored` doesn't catch event-handler throws) |
| 4 | async handler that rejects | CLI | `[FOREIGN_HANDOFF] Component App: pending false; fails global:Error \| unknown; … not handled — wrap in Errored or handle with attempt/catch` | root | 0–1 (same misleading advice; `Errored` won't catch a rejected promise in an event handler) |
| 5 | `catch { return [] }` that swallows | none (0 errors) | – | – | 0 (no warning; arguably legitimate code, but the lint rule for swallows is strict-dialect only) |
| 6 | memo that writes | CLI | `App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.` (+ root `FOREIGN_HANDOFF … fails any … requires any`) | right (the `setCount`) | 2 (the extra `any` cascade is noise) |
| 7 | `count()` read in `setTimeout` | CLI | `App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.` | wrong (the function name, `[generated]`) | 0 (reads in setTimeout are legal and untracked in Solid. The message doesn't say what to handle, and the line is wrong. It's a false positive in effect.) |
| 8 | `Portal` | warning only | `App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.` | right (26:7) | 1 (accurate, but "provenance C", "select its source with a checked contract" are inscrutable; exit code stays 0) |
| 9 | destructured props | CLI | `App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.` | the function line (fine) | 1 (it correctly refuses; "checked snapshot-versus-path mapping" gives no fix) |
| 10 | conditional read | none | – | – | n/a (legal Solid, correctly silent) |
| 11 | nested component defined inline | none | – | – | n/a (no warning; I'd expect one if sugar has a "components are top-level" rule) |
| 12 | `createEffect(() => …)` wrong arity | CLI **and** TSC | CLI: `App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.` TSC: `src/App.tsx(8,3): error TS2554: Expected 2-3 arguments, but got 1.` | right | 2 (most actionable: names the two phases) |

Subtotal for the ten that are real errors (1–9 + 12, with 3a/3b/3c/4 counted individually, i.e. 13 items): 1+1+0+1+0+0–1+0+2+0+1+1+2 ≈ **9 / 26**.

**Lint:** `eslint-plugin-solid-yield`'s recommended config, as printed in the README, **flags every `createSignal`/`createMemo` import in a native app** (`no-foreign-reactive`) and wants `jsxFactory`. It is unusable on native files. I did not count lint as catching anything.

**Pattern.** The tool is good at *structural* refusals with exact lines (1, 6, 12, 9). It is weak at *where*: anything involving failure/pending/context is reported on the `render()` line, and callback-related checks use `[generated]` positions at the function name. Advice for failures ("wrap in Errored") is wrong for event handlers.

---

## Step 4. Shipped native examples

Commands (run from the repo root), all passed:

```
node scripts/native-todos-check.mjs transform        -> native Todos transform: PASS (4 inference passes)
node scripts/native-todos-check.mjs lint             -> native Todos lint: PASS (4 inference passes)
node packages/ts-plugin-yield/src/cli.cjs check examples/originals/todos --native 'src/**'   -> 5 files, 0 errors
node examples/harness/native-todos/check.mjs parity  -> native Todos client parity: 27 states match original
                                                        native Todos hydrated parity: 27 states match original
node examples/harness/native-todos/check.mjs ssr     -> native Todos streamed SSR smoke: two seeded todos match original; no render errors
```

Sierpinski: transform/lint PASS (3 inference passes), CLI `1 files, 0 errors`, `client parity: 11 states match original`, `hydrated parity: 11 states match original`, `streamed SSR smoke: 729 dots match original`.

What it showed: Ryan Carniato's Solid 2 todos and Sierpinski, unchanged source, run through the transform with identical DOM states to the originals, clean on the color check. That is a legitimately strong result. Caveat: these are the two apps the transform was developed against; my own 40-line app needed a tooling workaround on first contact (Step 1) and then produced a false negative (Step 2).

---

## Step 5. TS plugin through tsserver

Feasible, and it worked from my app. `pnpm -C packages/ts-plugin-yield test` → 19/19 pass (real tsserver protocol tests).

My own probe (`tsprobe.cjs`: spawn `tsserver`, `open`, `semanticDiagnosticsSync`, `quickinfo`) with the plugin configured in my tsconfig:

- diagnostics: `3:15 1360 [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.`
- hover on `App`: `App: pending true; fails none; may-wait false; requires none`

Hover on a JSX prop returned an unrelated raw type: `(property) value: string | Source<string, never, false> | HoleProp<string>`. Not tested in a real editor UI (the README itself says so).

---

## Step 6. Verdict

**Would I use this on a real app today?** No. It is a research prototype (`0.0.0`, unreleased, the build needs `link:` to a sibling clone) with a clear and interesting idea. The README says as much ("This is a design lab"). Treat it as a type-level audit tool for experiments, not as a CI gate.

**Three things most in need of fixing, in order:**
1. **Diagnostic location.** Pending/fails/requires errors should point at the read (`createMemo(() => fetchItems())`, `useContext(UserCtx)`), not at `render(() => <App/>)`, and ideally say which boundary would absorb it. Callback checks showing `[generated]` at the function name should point at the callback.
2. **Packaging and docs for native mode.** The root README doesn't mention native mode at all; `file:` installs fail; there's no full native tsconfig/Vite/ESLint snippet; the recommended ESLint config rejects every plain Solid call.
3. **False negatives/positives and misleading advice.** `<For>` callback error invisible to the CLI; reads in `setTimeout` flagged; throws in event handlers told to "wrap in Errored" (which can't catch them); `throw 'string'` in a component body reported as `SUGAR_RETURN`.

**Most impressive:** the same plain Solid source (no annotations, no `yield*`) gets `App: pending true; fails none; may-wait false; requires none` as a hover, and the two shipped Solid originals run unchanged with exact DOM parity (27 and 11 states, plus hydration and SSR). Removing a `Loading` or a provider produces a precise, correct error at the root with no code changes in the components.

**README sentences that over-promise (verbatim):**
- "write plain Solid 2, add the Vite plugin and the TS plugin" (my paraphrase of the user brief; the root README says nothing like this and describes only the strict dialect.)
- ts-plugin README: "It checks the **generated library code** … then maps diagnostics and hovers to the author's file." Mapping works for some errors but `[generated]` positions at a function name appear for callback errors.
- sugar-design.md: "The editor plugin, value-facing hovers, source maps and related-location messages remain planned." vs the ts-plugin README saying they are implemented, so the doc set disagrees with itself.
- Root README: "The lint covers what TypeScript can't see. Its message names the line to write, and many of its rules autofix." Not usable on native files (see Step 1/3).
- ts-plugin README: "The CLI loads the nearest tsconfig, including its options and aliases, checks its files, and prints `file:line:column error TS<number>: [CODE] message`." True in format, but my `<For>` type error was not in the output.

---

## 10-line summary
1. Native mode isn't mentioned in the root README. The path to "plain Solid 2" is buried in the ts-plugin README.
2. The README's `file:` install fails for the TS plugin (`workspace:*` deps) and breaks `vite build` (relative import into `compiler-yield`); `link:` is required.
3. After switching to `link:`, `vite build`, a vitest/jsdom render and `solid-yield check` all work on a plain Solid app.
4. Root-level PENDING_ROOT / NO_PROVIDER / FOREIGN_HANDOFF diagnostics are correct and have working fixes, but they point at `render()` rather than the offending read.
5. 12 mistakes: roughly 9/26 points. Structural ones (setup read, memo write, effect arity) are caught on the right line; failure advice ("wrap in Errored") is wrong for event handlers; reads in `setTimeout` are flagged wrongly with a `[generated]` position.
6. A `<For>` callback type error was caught by `tsc` but not by the CLI (false negative).
7. The recommended ESLint config rejects every `createSignal`/`createMemo` in a native app; it's unusable there.
8. The shipped native todos and sierpinski pass transform, lint, CLI, client parity (27 and 11 states), hydrated parity and SSR smoke.
9. tsserver works through the plugin (19/19 tests, and my own probe: diagnostics and an `App: pending true; fails none; may-wait false; requires none` hover).
10. Verdict: not yet usable on a real app; top fixes are diagnostic locations, native-mode docs/packaging, and false positives/negatives and misleading advice.

Path: `/private/tmp/sy-review-out/REVIEW.md`
