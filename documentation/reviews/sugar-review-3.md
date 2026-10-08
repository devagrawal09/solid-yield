# solid-yield "plain Solid 2" mode — independent newcomer review

Checkout: /private/tmp/sy-review3 (proto/sugar-ls, ed90200). App: /private/tmp/sy-review3-out/app. Raw logs: cli1.txt, cli2.txt, mut1-3.txt, harness.txt, notes.md, base/ (final clean app source), ts.cjs (tsserver hover/diag helper), mut.py (mutation runner).

**Mode note.** The brief said "sugar mode", but the README's promise ("plain Solid 2 + Vite plugin + TS plugin") is what the README calls *native* mode (`mode: "native"`, no `"use yield"`). "Sugar mode" in the README is the `"use yield"` directive dialect with library calls, not plain Solid. I followed the README and used `mode: "native"`. `"use server"` is just an ordinary directive string here: removing it from api.ts changed nothing in the output; typed failures come from inferring `throw new X` through async functions.

## 1. Install and build the app

**Expected:** README steps work verbatim. **Actual:**
- README sends you to packages/ts-plugin-yield/README.md. Build + pack steps worked. `/tmp/solid-yield-packs` already contained tarballs older than the checkout (18:36 vs commit 20:33), so I re-packed into my own dir and pointed the overrides there (one deviation from the literal text). The pnpm-workspace overrides + two `pnpm add` commands worked first time (3.9 s). `pnpm exec solid-yield` exists. `vite build` succeeded; ESLint ran with no output.
- App: errors.ts (`ApiError`, `NotFound`, `RateLimited`), api.ts (`"use server"`, `listProducts` throws RateLimited every 5th call, `getProduct` throws NotFound, `placeOrder`), format.ts (no directive), cart (context holding `createSignal`), ProductList, Details, Checkout (async submit), Clock (setInterval), index.tsx with Errored/Loading.
- **Reaching a checkable 200-line plain Solid app took ~40 CLI iterations**, because many ordinary patterns are refused or cascade (details in step 2). I changed my app's shape repeatedly to stay inside what the tool supports; the final app is *not* the app I first wrote.

## 2. CLI check, diagnostics, fixes, hover

### First diagnostics (verbatim), in the order met
1. First run of my natural code:
   `ProductList.tsx:5:17 error TS95000: [SUGAR_CALLBACK] Move this reactive read into JSX, a memo, an effect, or an event.`
   - Right line? **No.** 5:17 is the *function name* `ProductList`, not the read. The read was `onClick={() => cart.add(p())}` inside a `<For>` child. My code *was* in an event. The message gives no help. Bisecting showed: an inline arrow in `onClick` that reads a signal/prop/accessor inside a component body is refused (`console.log(p())` too). The README's own 15-line example has `onClick={() => setCount(count() + 1)}` and passes, so the rule is not what the message says. It also moved: with a different edit the same code reported at `cart.tsx:7:54` (a different file).
2. Same family, after more edits: `Checkout.tsx:19:6 error TS95000: [BABEL_PARSE_ERROR] /private/tmp/sy-review3-out/app/src/ProductList.tsx: Unexpected reserved word 'yield'. (19:5)` — followed by a dump of the generated code `(yield* cart.setItems)([...(yield* cart.items)(), {`. **Wrong file** (reported against Checkout.tsx; message names ProductList.tsx) and leaks lowered code. Trigger: a named setup-level handler `const add = (e) => {...; setItems([...items(), ...])}` used as `onClick={add}`. Neighbouring forms passed.
3. Same root cause, different symptom: the CLI **crashed**: `Error: Debug Failure. False expression. at computePositionOfLineAndCharacter ... ts-plugin-solid-yield/src/service.cjs:193:18` (a transform error's line/column from generated code is applied to the original file without clamping). Reproduced 3 times (crash1.txt).
4. `Checkout.tsx:21:21 error TS95000: [EVENT_REJECTS] This handler can fail with unknown and nothing catches it; wrap the body in try/catch, or declare the failure.` — right line (the `onSubmit={submit}` binding), message understandable, fix right *but*: my submit had a try/catch around `await placeOrder`. The "unknown" came from `String(new FormData(...).get("email"))` and `e.preventDefault()` *before* the `try`. Any call to a built-in is an "unknown" failure source. The message does not say what it is; only hover does. Fix: move the whole body into the `try`. Applied, cleared.
5. `Checkout.tsx:6:17 error TS2345: [generated] [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.` and the same at `Details.tsx:4:17`, `index.tsx:8:10`. **Not actionable.** They were follow-ons of unknown-failure contagion (below).
6. `Details.tsx:6:34 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Handle failures inside p or its callbacks; this imported component (createMemo from solid-js) is outside the native check.` **Bogus.** I had a local variable `p` (`const p = createMemo(...)`) and a plain `<p>` intrinsic tag at col 34. The tool resolved the lowercase JSX tag `<p>` to my variable. Renaming `p` -> `prod` removed it. A name collision with an HTML tag produces a message about "createMemo" as an "imported component".
7. For-item misuse was mine (Solid 2 rc.13's default `For` passes the item, not an accessor) and the tool's `ProductList.tsx:10:58 error TS2349: This expression is not callable. Type 'Product' has no call signatures.` was correct (ordinary TS message).
8. Provider wrapper component: I wrote the usual `CartProvider(props:{children: JSX.Element})` that renders `<CartCtx value=...>{props.children}</CartCtx>`. Result: `ProductList.tsx:6:40 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: CartCtx.` even though `<CartProvider>` wraps it. With `children: any` it was worse: `cart.tsx:7:33 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: unknown.`, `cart.tsx:7:33 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.`, `cart.tsx:5:17 error TS2322: [generated] [LAZY_VIEW] children is a lazy view: function* () { return <.../>; }` — location is `{props.children}` in the provider, far from the real cause. Workaround: put `<CartCtx value={...}>` directly in `App`. (A custom provider component is the most common context pattern in Solid.)
9. Unknown-failure contagion from helper modules (this is the "third-party-ish helper without a directive" case). Hover: `Details — can suspend (pending); can fail with an unknown error (from n.toFixed at format.ts:2); can wait; needs an unknown context`. Replacing `toFixed` with `Math.round` gave `(from Math.round at format.ts:2)`; `reduce` and `String(e)` likewise (`String at index.tsx:12`). `"use pure"` at the top of format.ts did not change it. One `money(prod().price)` in a hole made `Details`, `Checkout`, `App` all "unknown error / can wait / needs an unknown context". I removed the helper from those components; it still works in ProductList where `money(p.price)` receives a plain For item. Calling a *signal accessor from a context-held tuple in a hole* (`items().length`) was also "unknown (from items at Checkout.tsx:22)"; I removed that too (Checkout can only read the cart inside the handler).
10. Cart design: an object context with arrow properties (`add: p => setItems([...items(), p])`) -> SUGAR_CALLBACK at `cart.tsx:7:54`; a `createStore` in context -> `Argument of type 'unknown' is not assignable to parameter of type 'string[]'` / `'_state' is of type 'unknown'`; `createContext<[Accessor<T>, Setter<T>]>` with a `createSignal` value -> `Type 'Source<Product[], never, false>' is not assignable to type 'Accessor<Product[]>'`. Only `ReturnType<typeof makeCart>` (a signal tuple) passed.

**Final state:** `solid-yield check: 9 files, 0 errors`; vite build ok; eslint silent.

### Hovers (tsserver quickinfo, as in the plugin tests; helper = ts.cjs), clean baseline
- `ProductList — can suspend (pending); can fail with __nativeChunk | RateLimited; does not wait; needs CartCtx`
- `Details — can suspend (pending); can fail with __nativeChunk | NotFound; does not wait; needs no context`
- `Checkout — does not suspend; never fails; does not wait; needs CartCtx`
- (also) `Clock — does not suspend; never fails; does not wait; needs no context`; `App — does not suspend; never fails; does not wait; needs no context`

Very good when it works: `NotFound` vs `RateLimited` per component is exactly the promise, and it came from reading throws in a `"use server"`-less async function in another file. Warts: `__nativeChunk` is an internal name (also `import("solid-yield").ChunkError` in App hovers, and "ChunkError" in messages — a user never wrote it); the Checkout "never fails" is right only because everything is in a try. **Whenever any file has a transform refusal or error (SUGAR_*, NATIVE_THROW), all hovers across the project fall back to e.g. `function ProductList(): JSX.Element`.**

## 3. Fifteen mistakes (each from the clean baseline; runner mut.py; raw: mut1-3.txt)

| # | Mistake | Caught? Tool / location | Message (verbatim) | Actionable | Score |
|---|---|---|---|---|---|
| 1 | empty catch (Checkout) | yes, CATCH_SWALLOWS, `Checkout.tsx:15:7` (the catch) | `This catch discards ChunkError \| RateLimited \| unknown without handling; return a fallback value, rethrow, or mark the absorption intentional with @yield-absorb.` | yes, fix options are right; "ChunkError" jargon | 2 |
| 2 | log-only catch | same | same text, same line | yes (console.error isn't "handling": strict but defensible) | 2 |
| 3 | `catch(e){ if (e instanceof ApiError) return []; throw e }` base-class catch in the list memo | no diagnostic; hover narrows to `can fail with __nativeChunk` (RateLimited gone) | none | hover is accurate; nothing flags that a sibling class is silently turned into `[]` | 1 |
| 4 | selective `instanceof RateLimited` + rethrow | clean (correct); hover `can fail with __nativeChunk`: precise narrowing | none | n/a | 2 |
| 5 | selective instanceof WITHOUT rethrow | yes, CATCH_SWALLOWS `ProductList.tsx:8:82` | `This catch discards ChunkError \| RateLimited without handling; ...` | right place; but RateLimited *is* handled in the branch — it's the other path that leaks. Hover says `never fails`. | 1 |
| 6 | `onClick={async () => { await placeOrder(...); await getProduct("zzz") }}` | yes, EVENT_REJECTS `Clock.tsx:7:45` | `This handler can fail with __nativeChunk \| unknown \| RateLimited \| NotFound and nothing catches it; wrap the body in try/catch, or declare the failure.` | yes | 2 |
| 7 | `placeOrder(...).then(() => setStatus("ok"))`, no `.catch` | only a refusal: `Checkout.tsx:12:18 [SUGAR_CALLBACK] Move this reactive read into JSX, a memo, an effect, or an event.` | wrong diagnosis (it is a signal *write* in a callback; not a missing catch); all hovers die | no | 1 |
| 8 | `throw "slow down"` in server fn | yes, NATIVE_THROW `api.ts:10:26` | `Throw an Error object so callers can identify and handle this failure.` | yes | 2 |
| 9 | `setTimeout(() => { throw new Error("late") })` | **no** (0 errors; Clock "never fails") | none | n/a | 0 |
| 10 | server fn starts throwing new `Banned` | no diagnostic (Errored has a catch-all fallback); hover on Details changes to `can fail with __nativeChunk \| Banned \| NotFound` | none | hover shows it; with a generic fallback nothing to enforce | 1 |
| 11 | `Promise.all([getProduct(..), getProduct("9")])` in memo | accidental: `Details.tsx:6:44 error TS2571: Object is of type 'unknown'.` (x2); hover `an unknown error (from Promise.all at Details.tsx:5)` | TS2571 is a **false positive** (plain tsc types the tuple); real signal only in hover | misleading | 1 |
| 12 | try/finally, no catch | yes, EVENT_REJECTS `Checkout.tsx:20:21` + `index.tsx:19:43 [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: import("solid-yield").ChunkError \| unknown \| RateLimited.` | handler message as #6 | yes (second diag shows the chain) | 2 |
| 13 | `createMemo(async () => { const x = await getProduct(...) })` | refusal only: `Details.tsx:5:68 error TS95000: [SUGAR_HOST] Reactive operations in async functions or methods are unsupported.` | no failure analysis; async memos are a core Solid 2 form | unsupported, hovers die | 1 |
| 14 | context read without provider | yes, NO_PROVIDER `ProductList.tsx:6:40` | `Add a context provider above this component; this context has no default value. Missing: CartCtx.` | yes (hover on App: `needs CartCtx`) | 2 |
| 15 | remove Errored | yes, FOREIGN_HANDOFF `ProductList.tsx:10:18` (the read), App hover lists failures | `Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: import("solid-yield").ChunkError \| RateLimited \| NotFound.` | yes; names the classes. "ChunkError" and `handle with attempt` (a library API I'm not using) are noise | 2 |

**Total: 22 / 30.** Strong where failures flow through plain `try/catch`, event bindings, `Errored`, and context. Weak on: timers (0), `.then` chains, async memos, Promise.all (each refused or mislabelled).

## 4. Native harness steps from the README

`node examples/harness/{native-todos,native-sierpinski}/check.mjs {parity,ssr}` — all exit 0:
- `native Todos client parity: 27 states match original`; `native Todos hydrated parity: 27 states match original`; `native Todos streamed SSR smoke: two seeded todos match original; no render errors`
- `native Sierpinski client parity: 11 states match original`; `native Sierpinski hydrated parity: 11 states match original`; `native Sierpinski streamed SSR smoke: 729 dots match original; no render errors`
- They show that the *transform* preserves runtime behaviour on two real apps (after the "minimal bulk-handler catch patch" for Todos). They say nothing about whether the checker's diagnostics are usable on new code, which is where I spent my time. The README's own `PENDING_ROOT` example reproduced exactly (`index.tsx:11:20 ... [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.` with the render as related location; README says line 11, `remote()`).

## 5. Verdict

**Would I use it on a real app today?** As an **advisory, non-blocking CI report or a hover aid on a small, conventional codebase**: yes, curious to. **As a gate: no.** Typed-failure hovers are the best feature (they were right on every component once the code was in the supported subset). But the supported subset is narrow and invisible: ordinary Solid (inline handlers reading signals, provider components, async memos, store/tuple contexts, any helper that calls a built-in, a variable named `p`) either trips a refusal with a misleading message at the wrong location, makes the CLI crash, or poisons the hovers with "unknown error". A single refusal turns off hovers in the whole project.

**Top three fixes**
1. Refusal/diagnostic quality: report SUGAR_CALLBACK / BABEL_PARSE_ERROR / GENERATED_TYPE at the offending authored expression and file, never the function name or another file; fix the `Debug Failure` crash (clamp positions in service.cjs:193); say *which* construct is unsupported. Keep hovers working for unaffected files.
2. Stop treating every built-in call (`Math.round`, `toFixed`, `String`, `FormData`, `includes`, `Promise.all` typing) as an "unknown" failure that infects callers; or at least tell the user the source in the diagnostic text (hover already does). Respect `"use pure"` as the README implies.
3. Support the common idioms: provider wrapper components, inline handlers reading signals, async `createMemo`, `.then` chains (report the missing catch), and timers (`setTimeout` throws). Hide `__nativeChunk` / `ChunkError` / `import("solid-yield")` from user-facing text.

**Most impressive:** the per-component failure type read straight off plain code across modules — `Details — ... can fail with __nativeChunk | NotFound`, `ProductList — ... RateLimited`, and then `... | Banned | NotFound` appearing in the hover the moment the server function gained a throw, with zero client change. Narrowing through `instanceof` + rethrow was exact (#4). CATCH_SWALLOWS with the `@yield-absorb` escape was a pleasant, well-judged rule.

**README sentences that over-promise (verbatim)**
- "Checked event handlers report `EVENT_REJECTS` at the handler when their inferred failures escape." — true, but "inferred failures" includes every built-in call, see step 2.4/2.9.
- (ts-plugin README) "Use the TS plugin or CLI for native failure and structural diagnostics." — a refusal in one file removes all hover info; some failures (#9) are invisible.
- "Native mode checks selected plain Solid 2 files and transforms them into the library's generator form before Vite compiles JSX." with "the supported forms have tests, but unsupported forms, generated-location fallbacks and missing runtime source maps remain." — the second half is honest; the first reads as if ordinary Solid works. In my run the unsupported forms were the common ones.
- "These two examples bound the tested scope; they do not establish that every Solid app works." — honest, and borne out.
- "`pnpm exec solid-yield check .` reports ... at `remote()` on line 11" — true for that 15-line app; my app's first diagnostics were mislocated.

## 10-line summary
1. Used native mode (README's "plain Solid"); "sugar" = `"use yield"` dialect, not tested; `"use server"` had no effect.
2. Install per ts-plugin README worked first try (re-packed tarballs into my own dir; /tmp ones were stale).
3. Getting a ~200-line plain app to check clean took ~40 iterations; common idioms were refused or mis-reported.
4. Bugs: SUGAR_CALLBACK at function name not the read; BABEL_PARSE_ERROR reported in the wrong file; CLI crash `Debug Failure` (service.cjs:193); `<p>` tag vs variable `p` bogus FOREIGN_BOUNDARY; provider wrapper -> NO_PROVIDER.
5. Built-in calls (`Math.round`, `toFixed`) in helpers make everything "unknown error"; `"use pure"` didn't help.
6. Hovers excellent when clean: `Details — ... can fail with __nativeChunk | NotFound`; internal `__nativeChunk`/`ChunkError` leak; any refusal blanks all hovers.
7. Fifteen mistakes: 22/30 (empty/log-only catch, throw string, no provider, no Errored, try/finally, async onClick all caught well; setTimeout throw missed; .then, async memo, Promise.all refused/mislabelled).
8. Harness: todos 27 client+27 hydrated states + SSR, sierpinski 11+11 + SSR, all pass; README PENDING_ROOT example reproduces.
9. Verdict: advisory report/hover on small conventional code, not a gate; fix diagnostic locations, unknown-contagion, common idioms.
10. Path: /private/tmp/sy-review3-out/REVIEW.md
