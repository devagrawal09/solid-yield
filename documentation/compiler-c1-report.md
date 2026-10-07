# C1 instance audit

C1 diagnostic checkpoint, 2026-10-07. This is an audit of source analysis, not emitted islands or measured savings. The CLI and Vite pre-pass now use the instance pass. The old static-site table is preserved in compiler-c1-before.json.

Reproduce: `node packages/compiler-yield/src/report.js --markdown documentation/compiler-c1-report.md`; `--json` exposes full expressions, instance IDs, all merge edges and reach lists. `--joined` runs the earlier engine; `--instances` remains an accepted alias for the default. No application module is executed by the analysis.

## Before / after

Each arrow is the report's previous value → audited value. E/V/L are eager/visible/lazy candidate group counts, not the v0.2 loading policy (v0.2 ships eager islands only). Group sizes are non-inert parts. Captures are rejected candidate edges, not serializer results. U counts are named syntactic origins, counted even when C dominates their consumers. The previous 275 entries and the new origin count have different precision and coverage; their difference is not a savings figure.

| Twin | Inert holes | Inert JSX | Groups E/V/L | Captures | U origins | After parts |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| docs-yield | 124/243 | 148/249 | 1/5/5 | 1 | 6 | 6E, 13V, 1V, 1V, 2L, 12L, 69V, 15L, 9V, 6L, 2L |
| effect-yield | 8/69 → 2/77 | 24/77 → 22/76 | 1/1/0 → 1/0/0 | 6 → 0 | 58 → 5 | 96E |
| hackernews-spa-yield | 28/70 → 1/75 | 43/66 → 19/65 | 0/4/0 → 0/4/0 | 0 → 0 | 12 → 7 | 1V, 35V, 30V, 12V |
| rendering-yield | 13/124 → 47/203 | 56/114 → 66/153 | 2/7/1 → 1/0/0 | 5 → 0 | 55 → 13 | 175E |
| room-yield | 28/96 → 5/109 | 31/75 → 23/78 | 1/0/0 → 1/1/0 | 10 → 0 | 47 → 6 | 122E, 1V |
| sierpinski-yield | 8/26 → 2/18 | 0/2 → 0/2 | 1/0/0 → 1/0/0 | 1 → 0 | 2 → 2 | 19E |
| sierpinski-yield-h | 1/6 → 1/7 | 0/0 → 0/0 | 1/0/0 → 1/0/0 | 1 → 0 | 4 → 2 | 19E |
| todos-yield | 6/34 → 0/36 | 4/29 → 3/29 | 1/0/0 → 1/0/0 | 1 → 0 | 44 → 2 | 55E |
| todos-yield-h | 3/16 → 8/37 | 0/0 → 0/0 | 1/0/0 → 1/0/0 | 2 → 0 | 53 → 2 | 53E |

The denominators changed: after counts are reached call-site instances, with one widened representative per recursive family/row; before counts were joined static sites. Repeated component calls count repeatedly, while uncalled module syntax no longer counts. These are neither runtime node counts nor markup bytes. JSX counts exclude foreign tags; locally S descendants beneath a foreign owner can still be unavailable as slots. Zero captures mainly reflects the broad merged groups: setup-local values stay inside them.

| h twin | Before h elements | After inert h elements |
| --- | --- | ---: |
| sierpinski-yield-h | unmeasured | 0/2 |
| todos-yield-h | unmeasured | 7/24 |

## Option A: changes since 3b51165

All nine twins were rerun with the same entry graphs. These arrows compare the same instance-based units, unlike the older table above. E/V/L describes dependencies; every emitted tier-1 root must hydrate synchronously.

| Twin | Inert holes before → after | Inert JSX before → after | Groups E/V/L before → after | Captures before → after |
| --- | ---: | ---: | --- | ---: |
| docs-yield | 127/243 → 124/243 | 149/249 → 148/249 | 1/2/3 → 1/5/5 | 1 → 1 |
| effect-yield | 4/77 → 2/77 | 22/76 → 22/76 | 1/0/0 → 1/0/0 | 0 → 0 |
| hackernews-spa-yield | 13/75 → 1/75 | 24/65 → 19/65 | 0/1/0 → 0/4/0 | 0 → 0 |
| rendering-yield | 47/202 → 47/203 | 68/153 → 66/153 | 1/0/0 → 1/0/0 | 0 → 0 |
| room-yield | 10/109 → 5/109 | 23/78 → 23/78 | 1/0/0 → 1/1/0 | 0 → 0 |
| sierpinski-yield | 2/18 → 2/18 | 0/2 → 0/2 | 1/0/0 → 1/0/0 | 0 → 0 |
| sierpinski-yield-h | 1/7 → 1/7 | 0/0 → 0/0 | 1/0/0 → 1/0/0 | 0 → 0 |
| todos-yield | 1/36 → 0/36 | 3/29 → 3/29 | 1/0/0 → 1/0/0 | 0 → 0 |
| todos-yield-h | 9/37 → 8/37 | 0/0 → 0/0 | 1/0/0 → 1/0/0 | 0 → 0 |

## U classification totals

GENUINE means client execution/lifetime is required under C0's rules, including foreign output kept U by policy; it does not mean every result actually changes. ANALYSIS BLIND SPOT means source inspection identifies S or C but the current transfer rule cannot retain it.

| Construct | Blind spot | Genuine | Total |
| --- | ---: | ---: | ---: |
| plain function call | 2 | 16 | 18 |
| helper routine | 0 | 1 | 1 |
| foreign primitive | 1 | 16 | 17 |
| router query | 0 | 3 | 3 |
| route props | 0 | 6 | 6 |
| serialization edge | 0 | 0 | 0 |
| other | 0 | 0 | 0 |
| **Total** | **3** | **42** | **45** |

| Twin | Blind spot | Genuine |
| --- | ---: | ---: |
| docs-yield | 0 | 6 |
| effect-yield | 1 | 4 |
| hackernews-spa-yield | 0 | 7 |
| rendering-yield | 0 | 13 |
| room-yield | 0 | 6 |
| sierpinski-yield | 0 | 2 |
| sierpinski-yield-h | 0 | 2 |
| todos-yield | 1 | 1 |
| todos-yield-h | 1 | 1 |

## Audit rules and limits

The inherited import, recursive-prop and foreign-slot fixtures were retained. Additional failing fixtures exposed imported data hidden by expressions/helpers, an initially S generator prop hiding a recursive C input, and recursion mutating a shared caller constant. These now pass: imported data flows to a named U origin; each instance owns its prop equations; recursive generator/opaque inputs widen those equations without changing caller values. Foreign owners and client-controlled flows never offer their descendants as independent slots. Equal spans merge as SPAN_OVERLAP; strictly nested groups can be candidate slots only without a recreation path. A timer registered in an effect is included in that effect's reach.

Sierpinski's setup timers are explicit eager causes despite having no $effect. The h rule counts nonliteral native props/children as holes, onX props as binds, and literal tags as element sites; component/flow children are analysed under the caller's owner. JSX expression uses are also counted, including structural component-call holes. Literal strings/numbers are inert values. These working clarifications to F-C1–F-C3 are documented in compiler-findings.md; C0 itself is not silently rewritten.

Remaining precision limits: no serializer execution, no proof of physical hydration spans, foreign lifetime/claim support is unproved, recursive families join all depths, and syntax-based boundary colors can over-merge. The Effect.runFork reference below is knowably module code (S at the edge), but a conditional return loses callable identity; resolving that requires preserving callable alternatives through helper returns. It stays U, with its rule and location visible. Fixing it cannot remove the adapter's genuine async lifetime or the foreign runtime owner. This table reports C1 only; see compiler-c2-finding.md and compiler-benchmarks.md for emission and measurements.

## docs-yield

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `<Router url={yield* props.url} />` — examples/docs-yield/src/app.tsx:51:13 | foreign primitive | **GENUINE**: Client router controls route ownership and navigation. A client input remains U under C0 §1.2. |
| `foreign(Home)` — examples/docs-yield/src/app.tsx:35:41 | route props | **GENUINE**: Router supplies params and navigation props. A client input remains U under C0 §1.2. |
| `foreign(DocPage)` — examples/docs-yield/src/app.tsx:36:51 | route props | **GENUINE**: Router supplies params and navigation props. A client input remains U under C0 §1.2. |
| `new Promise<void>(resolve => setTimeout(resolve, ms))` — examples/docs-yield/src/api.ts:32:31 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `search(value)` — examples/docs-yield/src/widgets.tsx:47:13 | plain function call | **GENUINE**: Non-server async function; its result is a client promise under C0 §1.2. A client input remains U under C0 §1.2. |
| `comments()` — examples/docs-yield/src/widgets.tsx:186:13 | plain function call | **GENUINE**: Non-server async function; its result is a client promise under C0 §1.2. A client input remains U under C0 §1.2. |

### Content-site premise after option A

The six widget definitions share no application signals or context. M6 now distinguishes the separate fresh promises returned by delay(): SearchBox and CommentList remain U/visible but form separate groups. The carousel src computed key and alt template interpolation both carry index's C provenance; its img is no longer an inert slot.

The actual result is **11 candidate groups (1/5/5 E/V/L)**, 124/243 inert holes and 148/249 inert JSX sites. ThemeToggle is the only eager cause; tier 1 nevertheless hydrates every emitted root at load.

Removing FOREIGN_OWNER edges separates the router owner, the Home foreign wrapper, Home's article error holes and Home's LikeButton. DocPage's article and like button still share the U route props: M6 and the rejected props capture join them. That is an actual input dependency, not foreign ancestry. Foreign descendants are reported separately and are still not offered as stable slots; navigation can recreate them.

The guide's two error holes stay joined by SPAN_OVERLAP: err().kind and err().message have the same paragraph span. The Home article has another instance of that pair. They are C/lazy in the analysis because the fallback error accessor is C, even with an S normal source. Neither is a seventh widget. Their span is absent during success and the accessor belongs to the Errored callback; codegen must preserve that boundary and edge, not hydrate a free-standing paragraph.

Relative to 3b51165, docs changes from six groups (1/2/3) to eleven (1/5/5); inert JSX changes from 149/249 to 148/249. The majority-inert premise survives. This count is not eleven independent physical hydration claims. Hackernews and room also split when foreign ancestry is removed; the table above records all changes, including newly visible expression reads.

### Groups and eager reach

ThemeToggle has the only $effect. It reads dark, writes no state and touches only its own cell. Its event, class hole, bind and label are pulled into that six-part eager group; no other widget is in eager reach.

Group 1: **eager, 6 parts**, element span examples/docs-yield/src/widgets.tsx:32:7. Components: ThemeToggle. Candidate slots: 0.

- $effect at examples/docs-yield/src/widgets.tsx:21:10.
  - Touched (1 parts, transitive reads/writes/calls): examples/docs-yield/src/widgets.tsx:19:34.
  - Pulled in (4 other parts through merges): examples/docs-yield/src/widgets.tsx:27:18, examples/docs-yield/src/widgets.tsx:32:22, examples/docs-yield/src/widgets.tsx:33:25, examples/docs-yield/src/widgets.tsx:33:48.

Group 2: **visible, 13 parts**, element span examples/docs-yield/src/widgets.tsx:53:7. Components: SearchBox. Candidate slots: 1.


Group 3: **visible, 1 parts**, foreign span examples/docs-yield/src/app.tsx:51:13. Components: App. Candidate slots: 0.


Group 4: **visible, 1 parts**, foreign-owner span examples/docs-yield/src/app.tsx:35:41. Components: App. Candidate slots: 0.


Group 5: **lazy, 2 parts**, element span examples/docs-yield/src/content.tsx:144:15. Components: ArticleContent. Candidate slots: 0.


Group 6: **lazy, 12 parts**, element span examples/docs-yield/src/widgets.tsx:127:7. Components: LikeButton. Candidate slots: 0.


Group 7: **visible, 69 parts**, foreign-owner span examples/docs-yield/src/app.tsx:36:51. Components: App, ArticleContent, ArticleBody, LikeButton, DocPage. Candidate slots: 0.


Group 8: **lazy, 15 parts**, element span examples/docs-yield/src/widgets.tsx:168:7. Components: NewsletterForm. Candidate slots: 1.


Group 9: **visible, 9 parts**, boundary span examples/docs-yield/src/widgets.tsx:195:18. Components: CommentList. Candidate slots: 0.


Group 10: **lazy, 6 parts**, element span examples/docs-yield/src/widgets.tsx:255:7. Components: ImageCarousel. Candidate slots: 1.


Group 11: **lazy, 2 parts**, element span examples/docs-yield/src/content.tsx:144:15. Components: ArticleContent. Candidate slots: 0.


Merge pairs M1/M2/M3/M4/M5/M6: 117/16/0/119/14/64. Additional pairs: SPAN_OVERLAP 2, FOREIGN_OWNER 0, CAPTURE_FALLBACK 53. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.

Capture: examples/docs-yield/src/app.tsx:23:45 `props`: setup-local non-source client value would cross the root edge.

## effect-yield

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `ManagedRuntime.make(layer, parent?.memoMap)` — examples/effect-yield/src/solid-effect.ts:53:19 | foreign primitive | **GENUINE**: External effect:ManagedRuntime.make. Foreign output is U under C0 §1.2; its owner stays client. |
| `<RuntimeContext value={runtime}>` — examples/effect-yield/src/app.tsx:100:17 | foreign primitive | **GENUINE**: Foreign component owns this subtree (C0 §1.3.5). A client input remains U under C0 §1.2. |
| `runEffect(searchPackages(q))` — examples/effect-yield/src/typeahead.tsx:103:13 | helper routine | **GENUINE**: Local adapter returns a non-server async iterable; its client lifetime is not inert. A client input remains U under C0 §1.2. |
| `Effect.runPromise(Effect.sleep(300).pipe(Effect.map(() => ORDERS.map(o => ({ ...o })))))` — examples/effect-yield/src/api.ts:164:10 | foreign primitive | **GENUINE**: External effect:Effect.runPromise. Foreign output is U under C0 §1.2; its owner stays client. |
| `Effect` — examples/effect-yield/src/solid-effect.ts:32:17 | foreign primitive | **ANALYSIS BLIND SPOT**: Effect.runFork is passed as module code, not read as reactive data. S as a module function reference under C0 §1.6; preserve callable identity through a conditional return. Calling the adapter still has a genuine client lifetime. |

### Groups and eager reach

No $effect. createRuntime calls ManagedRuntime.make during setup; its unknown lifetime and the RuntimeContext owner pull Typeahead, Results, Checkout, Orders and LogPanel into the eager group.

Group 1: **eager, 96 parts**, boundary span examples/effect-yield/src/app.tsx:91:18. Components: App, Typeahead, Results, Checkout, Orders, LogPanel. Candidate slots: 0.

- setup work at examples/effect-yield/src/solid-effect.ts:53:19: `ManagedRuntime.make(layer, parent?.memoMap)`.
  - Touched (0 parts, transitive reads/writes/calls): none.
  - Pulled in (95 other parts through merges): examples/effect-yield/src/log.ts:25:40, examples/effect-yield/src/log.ts:26:18, examples/effect-yield/src/log.ts:32:17, examples/effect-yield/src/app.tsx:80:32, examples/effect-yield/src/app.tsx:81:25, examples/effect-yield/src/app.tsx:84:24, examples/effect-yield/src/app.tsx:113:33, examples/effect-yield/src/app.tsx:114:35, examples/effect-yield/src/app.tsx:119:33, examples/effect-yield/src/app.tsx:120:35, examples/effect-yield/src/app.tsx:128:32, examples/effect-yield/src/app.tsx:129:33, examples/effect-yield/src/typeahead.tsx:94:36, examples/effect-yield/src/typeahead.tsx:99:26, examples/effect-yield/src/typeahead.tsx:108:19, examples/effect-yield/src/typeahead.tsx:126:17, examples/effect-yield/src/typeahead.tsx:127:19, examples/effect-yield/src/typeahead.tsx:131:18, examples/effect-yield/src/typeahead.tsx:132:19, examples/effect-yield/src/typeahead.tsx:47:18, examples/effect-yield/src/typeahead.tsx:49:18, examples/effect-yield/src/typeahead.tsx:50:19, examples/effect-yield/src/typeahead.tsx:64:28, examples/effect-yield/src/typeahead.tsx:43:16, examples/effect-yield/src/typeahead.tsx:71:56, examples/effect-yield/src/typeahead.tsx:72:56, examples/effect-yield/src/typeahead.tsx:75:33, examples/effect-yield/src/typeahead.tsx:56:19, examples/effect-yield/src/typeahead.tsx:146:62, examples/effect-yield/src/typeahead.tsx:147:45, examples/effect-yield/src/checkout.tsx:123:34, examples/effect-yield/src/checkout.tsx:126:27, examples/effect-yield/src/checkout.tsx:135:36, examples/effect-yield/src/checkout.tsx:137:38, examples/effect-yield/src/checkout.tsx:138:48, examples/effect-yield/src/checkout.tsx:140:24, examples/effect-yield/src/solid-effect.ts:164:16, examples/effect-yield/src/checkout.tsx:187:27, examples/effect-yield/src/checkout.tsx:190:17, examples/effect-yield/src/checkout.tsx:199:18, examples/effect-yield/src/checkout.tsx:202:25, examples/effect-yield/src/checkout.tsx:220:20, examples/effect-yield/src/checkout.tsx:123:34, examples/effect-yield/src/checkout.tsx:223:35, examples/effect-yield/src/checkout.tsx:229:35, examples/effect-yield/src/checkout.tsx:238:47, examples/effect-yield/src/checkout.tsx:241:36, examples/effect-yield/src/checkout.tsx:242:35, examples/effect-yield/src/checkout.tsx:246:25, examples/effect-yield/src/checkout.tsx:247:42, examples/effect-yield/src/checkout.tsx:247:68, examples/effect-yield/src/checkout.tsx:252:26, examples/effect-yield/src/checkout.tsx:262:39, examples/effect-yield/src/checkout.tsx:268:44, examples/effect-yield/src/checkout.tsx:268:73, examples/effect-yield/src/checkout.tsx:272:20, examples/effect-yield/src/checkout.tsx:187:27, examples/effect-yield/src/checkout.tsx:283:50, examples/effect-yield/src/checkout.tsx:276:51, examples/effect-yield/src/checkout.tsx:277:36, examples/effect-yield/src/checkout.tsx:297:38, examples/effect-yield/src/checkout.tsx:307:29, examples/effect-yield/src/checkout.tsx:322:18, examples/effect-yield/src/checkout.tsx:137:38, examples/effect-yield/src/checkout.tsx:326:33, examples/effect-yield/src/checkout.tsx:326:61, examples/effect-yield/src/checkout.tsx:74:18, examples/effect-yield/src/checkout.tsx:75:19, examples/effect-yield/src/checkout.tsx:85:28, examples/effect-yield/src/checkout.tsx:345:42, examples/effect-yield/src/checkout.tsx:91:54, examples/effect-yield/src/checkout.tsx:93:33, examples/effect-yield/src/checkout.tsx:94:33, examples/effect-yield/src/checkout.tsx:95:33, examples/effect-yield/src/checkout.tsx:97:57, examples/effect-yield/src/checkout.tsx:335:70, examples/effect-yield/src/app.tsx:26:30, examples/effect-yield/src/app.tsx:29:17, examples/effect-yield/src/app.tsx:37:27, examples/effect-yield/src/app.tsx:40:18, examples/effect-yield/src/app.tsx:41:19, examples/effect-yield/src/app.tsx:51:28, examples/effect-yield/src/app.tsx:26:30, examples/effect-yield/src/app.tsx:56:39, examples/effect-yield/src/app.tsx:57:54, examples/effect-yield/src/app.tsx:58:54, examples/effect-yield/src/app.tsx:59:53, examples/effect-yield/src/app.tsx:100:17, examples/effect-yield/src/app.tsx:94:42, examples/effect-yield/src/app.tsx:95:33, examples/effect-yield/src/app.tsx:91:18, examples/effect-yield/src/typeahead.tsx:143:30, examples/effect-yield/src/typeahead.tsx:154:40, examples/effect-yield/src/checkout.tsx:334:18, examples/effect-yield/src/checkout.tsx:340:28.

Merge pairs M1/M2/M3/M4/M5/M6: 112/23/0/123/131/27. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.

Finding: examples/effect-yield/src/solid-effect.ts:53:19: Opaque setup call may start observable work; eager fallback

## hackernews-spa-yield

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `<Router>` — examples/hackernews-spa-yield/src/app.tsx:36:7 | foreign primitive | **GENUINE**: Client router controls route ownership and navigation. A client input remains U under C0 §1.2. |
| `foreign(Stories)` — examples/hackernews-spa-yield/src/app.tsx:23:18 | route props | **GENUINE**: Router supplies params and navigation props. A client input remains U under C0 §1.2. |
| `foreign(Story)` — examples/hackernews-spa-yield/src/app.tsx:26:52 | route props | **GENUINE**: Router supplies params and navigation props. A client input remains U under C0 §1.2. |
| `foreign(User)` — examples/hackernews-spa-yield/src/app.tsx:27:50 | route props | **GENUINE**: Router supplies params and navigation props. A client input remains U under C0 §1.2. |
| `getStories(type2, page2)` — examples/hackernews-spa-yield/src/routes/stories.tsx:31:13 | router query | **GENUINE**: Router query cache/RPC remains U under C0 §2.2. A client input remains U under C0 §1.2. |
| `getStory(id2)` — examples/hackernews-spa-yield/src/routes/story.tsx:19:13 | router query | **GENUINE**: Router query cache/RPC remains U under C0 §2.2. A client input remains U under C0 §1.2. |
| `getUser(id2)` — examples/hackernews-spa-yield/src/routes/user.tsx:16:13 | router query | **GENUINE**: Router query cache/RPC remains U under C0 §2.2. A client input remains U under C0 §1.2. |

### Groups and eager reach

No eager group or $effect. Foreign lifetime constraints are reported separately from dependency grouping.

Group 1: **visible, 1 parts**, foreign span examples/hackernews-spa-yield/src/app.tsx:36:7. Components: App. Candidate slots: 0.


Group 2: **visible, 35 parts**, foreign-owner span examples/hackernews-spa-yield/src/app.tsx:23:18. Components: App, Stories, Story. Candidate slots: 0.


Group 3: **visible, 30 parts**, foreign-owner span examples/hackernews-spa-yield/src/app.tsx:26:52. Components: App, Story, Comment, Toggle. Candidate slots: 0.


Group 4: **visible, 12 parts**, foreign-owner span examples/hackernews-spa-yield/src/app.tsx:27:50. Components: App, User. Candidate slots: 0.


Merge pairs M1/M2/M3/M4/M5/M6: 114/1/0/66/70/114. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.

Finding: examples/hackernews-spa-yield/src/components/comment.tsx:35:54: Comment: recursive family widened, not a dynamic instance count

## rendering-yield

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `<Portal>` — examples/rendering-yield/shared/src/components/Settings.tsx:40:11 | foreign primitive | **GENUINE**: Foreign component owns this subtree (C0 §1.3.5). A client input remains U under C0 §1.2. |
| `<Reveal order={yield* order} collapsed={yield* collapsed}>` — examples/rendering-yield/shared/src/components/Reveal.tsx:178:19 | foreign primitive | **GENUINE**: Foreign component owns this subtree (C0 §1.3.5). A client input remains U under C0 §1.2. |
| `<Reveal order="natural">` — examples/rendering-yield/shared/src/components/Reveal.tsx:196:23 | foreign primitive | **GENUINE**: Foreign component owns this subtree (C0 §1.3.5). A client input remains U under C0 §1.2. |
| `<Reveal order={yield* order} collapsed={yield* collapsed}>` — examples/rendering-yield/shared/src/components/Reveal.tsx:193:19 | foreign primitive | **GENUINE**: Foreign component owns this subtree (C0 §1.3.5). A client input remains U under C0 §1.2. |
| `new Promise<User>(resolve => { setTimeout(() => resolve({ firstName: "Jon", lastName: "Snow" }), 400); })` — examples/rendering-yield/shared/src/components/Profile/index.tsx:14:9 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `new Promise<string[]>(resolve => { setTimeout(() => resolve(["Something Interesting", "Something else you might care about", "Or maybe not"]), 400); })` — examples/rendering-yield/shared/src/components/Profile/index.tsx:27:9 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `new Promise(resolve => setTimeout(resolve, 1000))` — examples/rendering-yield/shared/src/components/Stream.tsx:31:11 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `getData()` — examples/rendering-yield/shared/src/components/Stream.tsx:39:27 | plain function call | **GENUINE**: Non-server async function; its result is a client promise under C0 §1.2. A client input remains U under C0 §1.2. |
| `accumulate()` — examples/rendering-yield/shared/src/components/Stream.tsx:103:13 | plain function call | **GENUINE**: Non-server async function; its result is a client promise under C0 §1.2. A client input remains U under C0 §1.2. |
| `async function* () { for await (const val of getData()) { state.push(val); yield; } }()` — examples/rendering-yield/shared/src/components/Stream.tsx:114:9 | plain function call | **GENUINE**: Non-server async function; its result is a client promise under C0 §1.2. A client input remains U under C0 §1.2. |
| `new Promise((resolve, reject) => { setTimeout(() => { if (id !== "1") { reject(new Error('Item ${id} not found')); return; } resolve({ title: "Test Item" }); }, 1500); })` — examples/rendering-yield/shared/src/components/ErrorStream.tsx:23:10 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `new Promise(resolve => setTimeout(() => resolve(value), ms))` — examples/rendering-yield/shared/src/components/Reveal.tsx:17:10 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `new Promise(resolve => setTimeout(resolve, ms))` — examples/rendering-yield/shared/src/components/Skeleton.tsx:43:30 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |

### Groups and eager reach

Home's run-once effect registers a 100 ms interval, invokes tick and writes s. The route flow can recreate pages; its boundary, shared router context and foreign Portal/Reveal owners pull all analysed route alternatives into this eager group. This is a static union of possible pages, not simultaneous mounted pages.

Group 1: **eager, 175 parts**, boundary span examples/rendering-yield/csr/client.tsx:8:14. Components: Router, Routes, Link, Home, ProfilePage, Profile, Facts, Settings, Stream, MemoList, InnerBoundaryItem, Title, OuterBoundaryItem, RevealPage, AsyncCard, CardBody, Skeleton, FeedCard. Candidate slots: 7.

- $effect at examples/rendering-yield/shared/src/components/Home.tsx:12:10.
  - Touched (3 parts, transitive reads/writes/calls): examples/rendering-yield/shared/src/components/Home.tsx:4:27, examples/rendering-yield/shared/src/components/Home.tsx:9:16, examples/rendering-yield/shared/src/components/Home.tsx:15:17.
  - Pulled in (171 other parts through merges): examples/rendering-yield/shared/src/router.tsx:41:45, examples/rendering-yield/shared/src/router.tsx:42:29, examples/rendering-yield/shared/src/router.tsx:50:27, examples/rendering-yield/shared/src/router.tsx:59:20, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/components/App.tsx:36:23, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/router.tsx:99:62, examples/rendering-yield/shared/src/components/App.tsx:46:23, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/router.tsx:99:62, examples/rendering-yield/shared/src/components/App.tsx:56:23, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/router.tsx:99:62, examples/rendering-yield/shared/src/components/App.tsx:66:23, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/router.tsx:99:62, examples/rendering-yield/shared/src/components/App.tsx:76:23, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/router.tsx:99:62, examples/rendering-yield/shared/src/components/App.tsx:86:23, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/router.tsx:99:62, examples/rendering-yield/shared/src/components/App.tsx:96:23, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/router.tsx:99:62, examples/rendering-yield/shared/src/components/App.tsx:107:22, examples/rendering-yield/shared/src/components/App.tsx:114:32, examples/rendering-yield/shared/src/components/App.tsx:115:33, examples/rendering-yield/shared/src/components/Home.tsx:25:15, examples/rendering-yield/shared/src/components/App.tsx:124:32, examples/rendering-yield/shared/src/components/App.tsx:125:33, examples/rendering-yield/shared/src/components/Profile/index.tsx:9:23, examples/rendering-yield/shared/src/components/Profile/index.tsx:21:23, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:51:13, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:27:18, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:65:42, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:31:28, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:55:50, examples/rendering-yield/shared/src/components/App.tsx:134:32, examples/rendering-yield/shared/src/components/App.tsx:135:33, examples/rendering-yield/shared/src/components/Settings.tsx:8:34, examples/rendering-yield/shared/src/components/Settings.tsx:9:44, examples/rendering-yield/shared/src/components/Settings.tsx:10:48, examples/rendering-yield/shared/src/components/Settings.tsx:14:17, examples/rendering-yield/shared/src/components/Settings.tsx:17:17, examples/rendering-yield/shared/src/components/Settings.tsx:20:16, examples/rendering-yield/shared/src/components/Settings.tsx:23:17, examples/rendering-yield/shared/src/components/Settings.tsx:29:24, examples/rendering-yield/shared/src/components/Settings.tsx:33:42, examples/rendering-yield/shared/src/components/Settings.tsx:33:64, examples/rendering-yield/shared/src/components/Settings.tsx:34:12, examples/rendering-yield/shared/src/components/Settings.tsx:35:39, examples/rendering-yield/shared/src/components/Settings.tsx:38:35, examples/rendering-yield/shared/src/components/Settings.tsx:45:47, examples/rendering-yield/shared/src/components/Settings.tsx:40:11, examples/rendering-yield/shared/src/components/Settings.tsx:39:9, examples/rendering-yield/shared/src/components/App.tsx:144:32, examples/rendering-yield/shared/src/components/App.tsx:145:33, examples/rendering-yield/shared/src/components/Stream.tsx:101:28, examples/rendering-yield/shared/src/components/Stream.tsx:111:28, examples/rendering-yield/shared/src/components/Stream.tsx:53:18, examples/rendering-yield/shared/src/components/Stream.tsx:143:36, examples/rendering-yield/shared/src/components/Stream.tsx:59:21, examples/rendering-yield/shared/src/components/Stream.tsx:59:39, examples/rendering-yield/shared/src/components/App.tsx:154:32, examples/rendering-yield/shared/src/components/App.tsx:155:33, examples/rendering-yield/shared/src/components/ErrorStream.tsx:43:23, examples/rendering-yield/shared/src/components/ErrorStream.tsx:55:17, examples/rendering-yield/shared/src/components/ErrorStream.tsx:43:23, examples/rendering-yield/shared/src/components/ErrorStream.tsx:55:17, examples/rendering-yield/shared/src/components/ErrorStream.tsx:43:23, examples/rendering-yield/shared/src/components/ErrorStream.tsx:55:17, examples/rendering-yield/shared/src/components/ErrorStream.tsx:43:23, examples/rendering-yield/shared/src/components/ErrorStream.tsx:55:17, examples/rendering-yield/shared/src/components/App.tsx:164:32, examples/rendering-yield/shared/src/components/App.tsx:165:33, examples/rendering-yield/shared/src/components/Reveal.tsx:85:36, examples/rendering-yield/shared/src/components/Reveal.tsx:86:44, examples/rendering-yield/shared/src/components/Reveal.tsx:87:34, examples/rendering-yield/shared/src/components/Reveal.tsx:93:20, examples/rendering-yield/shared/src/components/Reveal.tsx:96:19, examples/rendering-yield/shared/src/components/Reveal.tsx:110:33, examples/rendering-yield/shared/src/components/Reveal.tsx:128:25, examples/rendering-yield/shared/src/components/Reveal.tsx:90:5, examples/rendering-yield/shared/src/components/Reveal.tsx:129:25, examples/rendering-yield/shared/src/components/Reveal.tsx:138:25, examples/rendering-yield/shared/src/components/Reveal.tsx:90:5, examples/rendering-yield/shared/src/components/Reveal.tsx:139:25, examples/rendering-yield/shared/src/components/Reveal.tsx:148:25, examples/rendering-yield/shared/src/components/Reveal.tsx:90:5, examples/rendering-yield/shared/src/components/Reveal.tsx:149:25, examples/rendering-yield/shared/src/components/Reveal.tsx:157:23, examples/rendering-yield/shared/src/components/Reveal.tsx:158:24, examples/rendering-yield/shared/src/components/Reveal.tsx:159:23, examples/rendering-yield/shared/src/components/Reveal.tsx:163:27, examples/rendering-yield/shared/src/components/Reveal.tsx:167:18, examples/rendering-yield/shared/src/components/Reveal.tsx:87:34, examples/rendering-yield/shared/src/components/Reveal.tsx:175:57, examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:27:14, examples/rendering-yield/shared/src/components/Reveal.tsx:66:59, examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:27:14, examples/rendering-yield/shared/src/components/Reveal.tsx:66:59, examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:27:14, examples/rendering-yield/shared/src/components/Reveal.tsx:66:59, examples/rendering-yield/shared/src/components/Reveal.tsx:178:19, examples/rendering-yield/shared/src/components/Reveal.tsx:188:55, examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:27:14, examples/rendering-yield/shared/src/components/Reveal.tsx:66:59, examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:27:14, examples/rendering-yield/shared/src/components/Reveal.tsx:66:59, examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:27:14, examples/rendering-yield/shared/src/components/Reveal.tsx:66:59, examples/rendering-yield/shared/src/components/Reveal.tsx:196:23, examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:27:14, examples/rendering-yield/shared/src/components/Reveal.tsx:66:59, examples/rendering-yield/shared/src/components/Reveal.tsx:193:19, examples/rendering-yield/shared/src/components/App.tsx:174:32, examples/rendering-yield/shared/src/components/App.tsx:175:33, examples/rendering-yield/shared/src/components/Skeleton.tsx:88:40, examples/rendering-yield/shared/src/components/Skeleton.tsx:92:23, examples/rendering-yield/shared/src/components/Skeleton.tsx:105:24, examples/rendering-yield/shared/src/components/Skeleton.tsx:121:19, examples/rendering-yield/shared/src/components/Skeleton.tsx:127:22, examples/rendering-yield/shared/src/components/Skeleton.tsx:63:15, examples/rendering-yield/shared/src/components/Skeleton.tsx:64:19, examples/rendering-yield/shared/src/components/Skeleton.tsx:67:11, examples/rendering-yield/shared/src/components/Skeleton.tsx:72:20, examples/rendering-yield/shared/src/components/Skeleton.tsx:73:21, examples/rendering-yield/shared/src/components/Skeleton.tsx:76:30, examples/rendering-yield/shared/src/components/Skeleton.tsx:149:39, examples/rendering-yield/csr/client.tsx:8:14, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:54:18, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:60:28, examples/rendering-yield/shared/src/components/Stream.tsx:138:22, examples/rendering-yield/shared/src/components/ErrorStream.tsx:89:18, examples/rendering-yield/shared/src/components/ErrorStream.tsx:97:28, examples/rendering-yield/shared/src/components/ErrorStream.tsx:89:18, examples/rendering-yield/shared/src/components/ErrorStream.tsx:97:28, examples/rendering-yield/shared/src/components/ErrorStream.tsx:120:18, examples/rendering-yield/shared/src/components/ErrorStream.tsx:126:28, examples/rendering-yield/shared/src/components/ErrorStream.tsx:120:18, examples/rendering-yield/shared/src/components/ErrorStream.tsx:126:28, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28.

Merge pairs M1/M2/M3/M4/M5/M6: 152/15/36/196/142/34. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.


## room-yield

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `<Router>` — examples/room-yield/src/app.tsx:20:17 | foreign primitive | **GENUINE**: Client router controls route ownership and navigation. A client input remains U under C0 §1.2. |
| `foreign(Live, { provided: [IdentityCtx] })` — examples/room-yield/src/routes.ts:18:50 | route props | **GENUINE**: Router supplies params and navigation props. A client input remains U under C0 §1.2. |
| `presence(room2, me2)` — examples/room-yield/src/routes/live.tsx:121:24 | foreign primitive | **GENUINE**: live server-function wrapper reconnects and supplies changing client data. A client input remains U under C0 §1.2. |
| `transcript(room3)` — examples/room-yield/src/routes/live.tsx:270:26 | foreign primitive | **GENUINE**: live server-function wrapper reconnects and supplies changing client data. A client input remains U under C0 §1.2. |
| `presence(name2, null)` — examples/room-yield/src/routes/live.tsx:482:24 | foreign primitive | **GENUINE**: live server-function wrapper reconnects and supplies changing client data. A client input remains U under C0 §1.2. |
| `roomCard(room2)` — examples/room-yield/src/routes/live.tsx:524:24 | foreign primitive | **GENUINE**: live server-function wrapper reconnects and supplies changing client data. A client input remains U under C0 §1.2. |

### Groups and eager reach

IdentityProvider's run-once effect calls mint and writes me. Identity context readers, presence/transcript/live data, the foreign router and its boundaries pull the room controls, chat, directory, summaries and archive into the group.

Group 1: **eager, 122 parts**, foreign-owner span examples/room-yield/src/routes.ts:18:50. Components: IdentityProvider, Live, Header, Joined, Members, StatusPill, Chaos, Chat, Messages, Composer, DirectoryEntry, Count, Card, CardBody, MemberCount, ActivityLine, Summary, SummaryText, Archive, ArchiveCount, Transcript. Candidate slots: 0.

- $effect at examples/room-yield/src/lib/identity.tsx:55:10.
  - Touched (1 parts, transitive reads/writes/calls): examples/room-yield/src/lib/identity.tsx:54:30.
  - Pulled in (120 other parts through merges): examples/room-yield/src/lib/identity.tsx:65:18, examples/room-yield/src/routes.ts:18:50, examples/room-yield/src/routes/live.tsx:65:23, examples/room-yield/src/lib/identity.tsx:79:10, examples/room-yield/src/components/status-pill.tsx:23:38, examples/room-yield/src/components/status-pill.tsx:24:38, examples/room-yield/src/components/status-pill.tsx:25:36, examples/room-yield/src/components/status-pill.tsx:27:18, examples/room-yield/src/routes/live.tsx:117:22, examples/room-yield/src/routes/live.tsx:126:25, examples/room-yield/src/routes/live.tsx:134:16, examples/room-yield/src/routes/live.tsx:173:18, examples/room-yield/src/routes/live.tsx:140:36, examples/room-yield/src/routes/live.tsx:179:30, examples/room-yield/src/routes/live.tsx:196:29, examples/room-yield/src/routes/live.tsx:197:49, examples/room-yield/src/routes/live.tsx:200:20, examples/room-yield/src/routes/live.tsx:201:21, examples/room-yield/src/routes/live.tsx:205:31, examples/room-yield/src/routes/live.tsx:206:23, examples/room-yield/src/components/status-pill.tsx:64:15, examples/room-yield/src/components/status-pill.tsx:65:15, examples/room-yield/src/components/status-pill.tsx:69:9, examples/room-yield/src/components/status-pill.tsx:70:9, examples/room-yield/src/routes/live.tsx:222:34, examples/room-yield/src/routes/live.tsx:223:16, examples/room-yield/src/routes/live.tsx:240:39, examples/room-yield/src/routes/live.tsx:244:18, examples/room-yield/src/routes/live.tsx:222:34, examples/room-yield/src/routes/live.tsx:247:43, examples/room-yield/src/lib/identity.tsx:79:10, examples/room-yield/src/components/status-pill.tsx:23:38, examples/room-yield/src/components/status-pill.tsx:24:38, examples/room-yield/src/components/status-pill.tsx:25:36, examples/room-yield/src/components/status-pill.tsx:27:18, examples/room-yield/src/routes/live.tsx:266:41, examples/room-yield/src/routes/live.tsx:276:40, examples/room-yield/src/routes/live.tsx:277:36, examples/room-yield/src/routes/live.tsx:278:16, examples/room-yield/src/components/status-pill.tsx:64:15, examples/room-yield/src/components/status-pill.tsx:65:15, examples/room-yield/src/components/status-pill.tsx:68:9, examples/room-yield/src/components/status-pill.tsx:69:9, examples/room-yield/src/components/status-pill.tsx:70:9, examples/room-yield/src/lib/identity.tsx:79:10, examples/room-yield/src/routes/live.tsx:353:18, examples/room-yield/src/routes/live.tsx:336:32, examples/room-yield/src/routes/live.tsx:359:27, examples/room-yield/src/routes/live.tsx:365:40, examples/room-yield/src/routes/live.tsx:366:40, examples/room-yield/src/routes/live.tsx:367:41, examples/room-yield/src/lib/identity.tsx:79:10, examples/room-yield/src/routes/live.tsx:394:34, examples/room-yield/src/routes/live.tsx:396:18, examples/room-yield/src/routes/live.tsx:405:17, examples/room-yield/src/routes/live.tsx:410:39, examples/room-yield/src/routes/live.tsx:412:17, examples/room-yield/src/routes/live.tsx:413:19, examples/room-yield/src/routes/live.tsx:414:23, examples/room-yield/src/routes/live.tsx:415:20, examples/room-yield/src/routes/live.tsx:418:40, examples/room-yield/src/routes/live.tsx:422:18, examples/room-yield/src/routes/live.tsx:312:17, examples/room-yield/src/routes/live.tsx:430:18, examples/room-yield/src/routes/live.tsx:435:19, examples/room-yield/src/components/status-pill.tsx:23:38, examples/room-yield/src/components/status-pill.tsx:24:38, examples/room-yield/src/components/status-pill.tsx:25:36, examples/room-yield/src/components/status-pill.tsx:27:18, examples/room-yield/src/routes/live.tsx:479:22, examples/room-yield/src/routes/live.tsx:488:17, examples/room-yield/src/routes/live.tsx:508:14, examples/room-yield/src/routes/live.tsx:500:21, examples/room-yield/src/routes/live.tsx:500:61, examples/room-yield/src/components/status-pill.tsx:23:38, examples/room-yield/src/components/status-pill.tsx:24:38, examples/room-yield/src/components/status-pill.tsx:25:36, examples/room-yield/src/components/status-pill.tsx:27:18, examples/room-yield/src/routes/live.tsx:521:61, examples/room-yield/src/routes/live.tsx:528:26, examples/room-yield/src/routes/live.tsx:535:27, examples/room-yield/src/components/status-pill.tsx:64:15, examples/room-yield/src/components/status-pill.tsx:65:15, examples/room-yield/src/components/status-pill.tsx:68:9, examples/room-yield/src/components/status-pill.tsx:69:9, examples/room-yield/src/components/status-pill.tsx:70:9, examples/room-yield/src/routes/live.tsx:550:18, examples/room-yield/src/routes/live.tsx:99:21, examples/room-yield/src/routes/live.tsx:578:14, examples/room-yield/src/routes/live.tsx:579:46, examples/room-yield/src/routes/live.tsx:617:9, examples/room-yield/src/routes/live.tsx:617:26, examples/room-yield/src/routes/live.tsx:629:24, examples/room-yield/src/routes/live.tsx:638:20, examples/room-yield/src/routes/live.tsx:629:24, examples/room-yield/src/routes/live.tsx:642:38, examples/room-yield/src/routes/live.tsx:650:11, examples/room-yield/src/routes/live.tsx:650:45, examples/room-yield/src/routes/live.tsx:664:42, examples/room-yield/src/routes/live.tsx:665:22, examples/room-yield/src/routes/live.tsx:719:23, examples/room-yield/src/routes/live.tsx:731:15, examples/room-yield/src/routes/live.tsx:685:41, examples/room-yield/src/routes/live.tsx:686:51, examples/room-yield/src/routes/live.tsx:740:24, examples/room-yield/src/routes/live.tsx:755:18, examples/room-yield/src/routes/live.tsx:101:21, examples/room-yield/src/routes/live.tsx:776:9, examples/room-yield/src/routes/live.tsx:776:43, examples/room-yield/src/routes/live.tsx:777:9, examples/room-yield/src/routes/live.tsx:76:62, examples/room-yield/src/routes/live.tsx:73:18, examples/room-yield/src/routes/live.tsx:137:22, examples/room-yield/src/routes/live.tsx:149:20, examples/room-yield/src/routes/live.tsx:331:18, examples/room-yield/src/routes/live.tsx:492:20, examples/room-yield/src/routes/live.tsx:583:20, examples/room-yield/src/routes/live.tsx:595:20, examples/room-yield/src/routes/live.tsx:677:18, examples/room-yield/src/routes/live.tsx:697:28.

Group 2: **visible, 1 parts**, foreign span examples/room-yield/src/app.tsx:20:17. Components: IdentityProvider. Candidate slots: 0.


Merge pairs M1/M2/M3/M4/M5/M6: 192/29/10/154/16/78. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.


## sierpinski-yield

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `new Promise<number>(res => { const t = requestIdleCallback(() => { const e = performance.now() + 0.8; while (performance.now() < e) {} res(seconds); }); onCleanup(() =…` — examples/sierpinski-yield/src/app.tsx:133:11 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `onCleanup` — examples/sierpinski-yield/src/app.tsx:29:10 | foreign primitive | **GENUINE**: Value imported from solid-js; its reactive provenance is not available. Unread imported data remains U under C0 §1.2. |

### Groups and eager reach

No $effect. Setup registers setInterval(tick, 1000) and requestAnimationFrame(update). They write seconds and elapsed; scale, recursive Triangle/Dot reads and their pending/error boundaries join the group.

Group 1: **eager, 19 parts**, boundary span examples/sierpinski-yield/src/app.tsx:81:18. Components: TriangleDemo, Container, Triangle, Dot. Candidate slots: 0.

- setup work at examples/sierpinski-yield/src/app.tsx:62:13: `setInterval(tick, 1000)`.
  - Touched (2 parts, transitive reads/writes/calls): examples/sierpinski-yield/src/app.tsx:53:40, examples/sierpinski-yield/src/app.tsx:59:16.
  - Pulled in (16 other parts through merges): examples/sierpinski-yield/src/app.tsx:52:40, examples/sierpinski-yield/src/app.tsx:54:24, examples/sierpinski-yield/src/app.tsx:65:18, examples/sierpinski-yield/src/app.tsx:69:7, examples/sierpinski-yield/src/app.tsx:109:15, examples/sierpinski-yield/src/app.tsx:128:31, examples/sierpinski-yield/src/app.tsx:251:36, examples/sierpinski-yield/src/app.tsx:252:19, examples/sierpinski-yield/src/app.tsx:255:18, examples/sierpinski-yield/src/app.tsx:263:15, examples/sierpinski-yield/src/app.tsx:272:22, examples/sierpinski-yield/src/app.tsx:273:22, examples/sierpinski-yield/src/app.tsx:275:9, examples/sierpinski-yield/src/app.tsx:67:9, examples/sierpinski-yield/src/app.tsx:81:18, examples/sierpinski-yield/src/app.tsx:87:28.
- setup work at examples/sierpinski-yield/src/app.tsx:69:7: `requestAnimationFrame(update)`.
  - Touched (3 parts, transitive reads/writes/calls): examples/sierpinski-yield/src/app.tsx:52:40, examples/sierpinski-yield/src/app.tsx:65:18, examples/sierpinski-yield/src/app.tsx:67:9.
  - Pulled in (15 other parts through merges): examples/sierpinski-yield/src/app.tsx:53:40, examples/sierpinski-yield/src/app.tsx:54:24, examples/sierpinski-yield/src/app.tsx:59:16, examples/sierpinski-yield/src/app.tsx:62:13, examples/sierpinski-yield/src/app.tsx:109:15, examples/sierpinski-yield/src/app.tsx:128:31, examples/sierpinski-yield/src/app.tsx:251:36, examples/sierpinski-yield/src/app.tsx:252:19, examples/sierpinski-yield/src/app.tsx:255:18, examples/sierpinski-yield/src/app.tsx:263:15, examples/sierpinski-yield/src/app.tsx:272:22, examples/sierpinski-yield/src/app.tsx:273:22, examples/sierpinski-yield/src/app.tsx:275:9, examples/sierpinski-yield/src/app.tsx:81:18, examples/sierpinski-yield/src/app.tsx:87:28.

Merge pairs M1/M2/M3/M4/M5/M6: 12/11/0/18/0/1. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.

Finding: examples/sierpinski-yield/src/app.tsx:62:13: setInterval starts work in setup; eager without $effect
Finding: examples/sierpinski-yield/src/app.tsx:69:7: requestAnimationFrame starts work in setup; eager without $effect
Finding: examples/sierpinski-yield/src/app.tsx:196:38: Triangle: recursive family widened, not a dynamic instance count
Finding: examples/sierpinski-yield/src/app.tsx:208:38: Triangle: recursive family widened, not a dynamic instance count
Finding: examples/sierpinski-yield/src/app.tsx:222:38: Triangle: recursive family widened, not a dynamic instance count

## sierpinski-yield-h

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `new Promise<number>(res => { const t = requestIdleCallback(() => { const e = performance.now() + 0.8; while (performance.now() < e) {} res(seconds); }); onCleanup(() =…` — examples/sierpinski-yield-h/src/app.ts:164:11 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |
| `onCleanup` — examples/sierpinski-yield-h/src/app.ts:29:10 | foreign primitive | **GENUINE**: Value imported from solid-js; its reactive provenance is not available. Unread imported data remains U under C0 §1.2. |

### Groups and eager reach

No $effect. Setup registers the same interval and animation-frame loop as the JSX twin. seconds, elapsed, scale and the recursive Triangle/Dot family join through reads and boundaries.

Group 1: **eager, 19 parts**, boundary span examples/sierpinski-yield-h/src/app.ts:78:12. Components: TriangleDemo, Container, Triangle, Dot. Candidate slots: 0.

- setup work at examples/sierpinski-yield-h/src/app.ts:62:13: `setInterval(tick, 1000)`.
  - Touched (2 parts, transitive reads/writes/calls): examples/sierpinski-yield-h/src/app.ts:53:40, examples/sierpinski-yield-h/src/app.ts:59:16.
  - Pulled in (16 other parts through merges): examples/sierpinski-yield-h/src/app.ts:52:40, examples/sierpinski-yield-h/src/app.ts:54:24, examples/sierpinski-yield-h/src/app.ts:65:18, examples/sierpinski-yield-h/src/app.ts:69:7, examples/sierpinski-yield-h/src/app.ts:92:16, examples/sierpinski-yield-h/src/app.ts:159:31, examples/sierpinski-yield-h/src/app.ts:194:36, examples/sierpinski-yield-h/src/app.ts:195:19, examples/sierpinski-yield-h/src/app.ts:198:18, examples/sierpinski-yield-h/src/app.ts:207:16, examples/sierpinski-yield-h/src/app.ts:195:19, examples/sierpinski-yield-h/src/app.ts:198:18, examples/sierpinski-yield-h/src/app.ts:221:7, examples/sierpinski-yield-h/src/app.ts:67:9, examples/sierpinski-yield-h/src/app.ts:78:12, examples/sierpinski-yield-h/src/app.ts:81:7.
- setup work at examples/sierpinski-yield-h/src/app.ts:69:7: `requestAnimationFrame(update)`.
  - Touched (3 parts, transitive reads/writes/calls): examples/sierpinski-yield-h/src/app.ts:52:40, examples/sierpinski-yield-h/src/app.ts:65:18, examples/sierpinski-yield-h/src/app.ts:67:9.
  - Pulled in (15 other parts through merges): examples/sierpinski-yield-h/src/app.ts:53:40, examples/sierpinski-yield-h/src/app.ts:54:24, examples/sierpinski-yield-h/src/app.ts:59:16, examples/sierpinski-yield-h/src/app.ts:62:13, examples/sierpinski-yield-h/src/app.ts:92:16, examples/sierpinski-yield-h/src/app.ts:159:31, examples/sierpinski-yield-h/src/app.ts:194:36, examples/sierpinski-yield-h/src/app.ts:195:19, examples/sierpinski-yield-h/src/app.ts:198:18, examples/sierpinski-yield-h/src/app.ts:207:16, examples/sierpinski-yield-h/src/app.ts:195:19, examples/sierpinski-yield-h/src/app.ts:198:18, examples/sierpinski-yield-h/src/app.ts:221:7, examples/sierpinski-yield-h/src/app.ts:78:12, examples/sierpinski-yield-h/src/app.ts:81:7.

Merge pairs M1/M2/M3/M4/M5/M6: 12/11/0/18/0/1. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.

Finding: examples/sierpinski-yield-h/src/app.ts:62:13: setInterval starts work in setup; eager without $effect
Finding: examples/sierpinski-yield-h/src/app.ts:69:7: requestAnimationFrame starts work in setup; eager without $effect
Finding: examples/sierpinski-yield-h/src/app.ts:185:9: Triangle: recursive family widened, not a dynamic instance count
Finding: examples/sierpinski-yield-h/src/app.ts:186:9: Triangle: recursive family widened, not a dynamic instance count
Finding: examples/sierpinski-yield-h/src/app.ts:187:9: Triangle: recursive family widened, not a dynamic instance count

## todos-yield

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `localStorage.getItem("TODOS")` — examples/todos-yield/src/api.ts:59:21 | plain function call | **ANALYSIS BLIND SPOT**: Unresolved callable. Resolve the callable and substitute its arguments and captured values. |
| `new Promise<T>(res => setTimeout(res, time, payload))` — examples/todos-yield/src/api.ts:51:10 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |

### Groups and eager reach

hashFilter's run-once effect installs the hashchange listener. onChange writes filter; the filtered list, shared store/actions, context, row recreation and boundaries pull Header, MainSection, TodoItem and Footer into the group.

Group 1: **eager, 55 parts**, boundary span examples/todos-yield/src/app.tsx:306:28. Components: App, Header, MainSection, TodoItem, Footer, TodoApp. Candidate slots: 2.

- $effect at examples/todos-yield/src/filter.ts:25:10.
  - Touched (2 parts, transitive reads/writes/calls): examples/todos-yield/src/filter.ts:21:38, examples/todos-yield/src/filter.ts:22:20.
  - Pulled in (52 other parts through merges): examples/todos-yield/src/todos.ts:99:36, examples/todos-yield/src/todos.ts:106:14, examples/todos-yield/src/todos.ts:116:17, examples/todos-yield/src/todos.ts:122:17, examples/todos-yield/src/todos.ts:134:16, examples/todos-yield/src/todos.ts:157:21, examples/todos-yield/src/todos.ts:172:21, examples/todos-yield/src/app.tsx:300:18, examples/todos-yield/src/app.tsx:47:10, examples/todos-yield/src/app.tsx:59:18, examples/todos-yield/src/app.tsx:77:21, examples/todos-yield/src/app.tsx:47:10, examples/todos-yield/src/app.tsx:140:27, examples/todos-yield/src/app.tsx:150:31, examples/todos-yield/src/app.tsx:153:18, examples/todos-yield/src/app.tsx:160:18, examples/todos-yield/src/app.tsx:161:19, examples/todos-yield/src/app.tsx:171:29, examples/todos-yield/src/app.tsx:172:30, examples/todos-yield/src/app.tsx:177:30, examples/todos-yield/src/app.tsx:140:27, examples/todos-yield/src/app.tsx:47:10, examples/todos-yield/src/app.tsx:86:18, examples/todos-yield/src/app.tsx:89:17, examples/todos-yield/src/app.tsx:92:18, examples/todos-yield/src/app.tsx:98:15, examples/todos-yield/src/app.tsx:111:21, examples/todos-yield/src/app.tsx:112:21, examples/todos-yield/src/app.tsx:114:18, examples/todos-yield/src/app.tsx:116:20, examples/todos-yield/src/app.tsx:117:21, examples/todos-yield/src/app.tsx:123:29, examples/todos-yield/src/app.tsx:124:31, examples/todos-yield/src/app.tsx:131:43, examples/todos-yield/src/app.tsx:47:10, examples/todos-yield/src/app.tsx:199:28, examples/todos-yield/src/app.tsx:202:28, examples/todos-yield/src/app.tsx:205:17, examples/todos-yield/src/app.tsx:212:18, examples/todos-yield/src/app.tsx:213:19, examples/todos-yield/src/app.tsx:220:29, examples/todos-yield/src/app.tsx:221:21, examples/todos-yield/src/app.tsx:225:42, examples/todos-yield/src/app.tsx:230:48, examples/todos-yield/src/app.tsx:237:31, examples/todos-yield/src/app.tsx:244:28, examples/todos-yield/src/app.tsx:245:29, examples/todos-yield/src/app.tsx:250:67, examples/todos-yield/src/app.tsx:309:52, examples/todos-yield/src/app.tsx:310:43, examples/todos-yield/src/app.tsx:306:28, examples/todos-yield/src/app.tsx:274:18.

Merge pairs M1/M2/M3/M4/M5/M6: 297/70/10/79/46/44. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.


## todos-yield-h

### Every remaining U origin

Expressions are abbreviated only for display; file:line:column identifies the full source expression. A repeated origin has one row even if several instances use it.

| Expression and location | Construct | Classification and resolving rule / client dependency |
| --- | --- | --- |
| `localStorage.getItem("TODOS")` — examples/todos-yield-h/src/api.ts:59:21 | plain function call | **ANALYSIS BLIND SPOT**: Unresolved callable. Resolve the callable and substitute its arguments and captured values. |
| `new Promise<T>(res => setTimeout(res, time, payload))` — examples/todos-yield-h/src/api.ts:51:10 | plain function call | **GENUINE**: Non-server promise; completion can change the client view. A client input remains U under C0 §1.2. |

### Groups and eager reach

The same hashchange effect reaches onChange and filter. Shared store/actions, context, row recreation and boundaries pull Header, MainSection, TodoItem and Footer into the group.

Group 1: **eager, 53 parts**, boundary span examples/todos-yield-h/src/app.ts:241:12. Components: App, Header, MainSection, TodoItem, Footer. Candidate slots: 2.

- $effect at examples/todos-yield-h/src/filter.ts:25:10.
  - Touched (2 parts, transitive reads/writes/calls): examples/todos-yield-h/src/filter.ts:21:38, examples/todos-yield-h/src/filter.ts:22:20.
  - Pulled in (50 other parts through merges): examples/todos-yield-h/src/todos.ts:99:36, examples/todos-yield-h/src/todos.ts:106:14, examples/todos-yield-h/src/todos.ts:116:17, examples/todos-yield-h/src/todos.ts:122:17, examples/todos-yield-h/src/todos.ts:134:16, examples/todos-yield-h/src/todos.ts:157:21, examples/todos-yield-h/src/todos.ts:172:21, examples/todos-yield-h/src/app.ts:252:7, examples/todos-yield-h/src/app.ts:42:10, examples/todos-yield-h/src/app.ts:50:18, examples/todos-yield-h/src/app.ts:50:18, examples/todos-yield-h/src/app.ts:42:10, examples/todos-yield-h/src/app.ts:132:27, examples/todos-yield-h/src/app.ts:142:31, examples/todos-yield-h/src/app.ts:145:27, examples/todos-yield-h/src/app.ts:148:18, examples/todos-yield-h/src/app.ts:168:11, examples/todos-yield-h/src/app.ts:132:27, examples/todos-yield-h/src/app.ts:42:10, examples/todos-yield-h/src/app.ts:77:18, examples/todos-yield-h/src/app.ts:80:17, examples/todos-yield-h/src/app.ts:83:18, examples/todos-yield-h/src/app.ts:86:26, examples/todos-yield-h/src/app.ts:110:9, examples/todos-yield-h/src/app.ts:111:17, examples/todos-yield-h/src/app.ts:116:24, examples/todos-yield-h/src/app.ts:80:17, examples/todos-yield-h/src/app.ts:86:26, examples/todos-yield-h/src/app.ts:106:20, examples/todos-yield-h/src/app.ts:77:18, examples/todos-yield-h/src/app.ts:83:18, examples/todos-yield-h/src/app.ts:152:12, examples/todos-yield-h/src/app.ts:145:27, examples/todos-yield-h/src/app.ts:142:31, examples/todos-yield-h/src/app.ts:148:18, examples/todos-yield-h/src/app.ts:42:10, examples/todos-yield-h/src/app.ts:177:28, examples/todos-yield-h/src/app.ts:180:28, examples/todos-yield-h/src/app.ts:183:27, examples/todos-yield-h/src/app.ts:186:17, examples/todos-yield-h/src/app.ts:226:9, examples/todos-yield-h/src/app.ts:227:17, examples/todos-yield-h/src/app.ts:186:17, examples/todos-yield-h/src/app.ts:204:12, examples/todos-yield-h/src/app.ts:183:27, examples/todos-yield-h/src/app.ts:214:11, examples/todos-yield-h/src/app.ts:248:46, examples/todos-yield-h/src/app.ts:241:12, examples/todos-yield-h/src/app.ts:241:12, examples/todos-yield-h/src/app.ts:259:11.

Merge pairs M1/M2/M3/M4/M5/M6: 306/70/10/76/24/45. Additional pairs: SPAN_OVERLAP 0, FOREIGN_OWNER 0, CAPTURE_FALLBACK 0. Counts include redundant union pairs; they are not counts of independent reasons or saved roots.


## Premise verdict

Dev's option A accepts the content-heavy premise. The corrected docs twin retains a majority of locally inert JSX and separate SearchBox, CommentList, ThemeToggle, NewsletterForm and ImageCarousel groups. It has eleven dependency groups in total, including route owners and error fallbacks. The other twins remain mostly interactive. Physical claims, capture serialization and byte savings require C2 evidence; these static counts alone establish none of them.

## C3: server-recomputable provenance (2026-10-07)

All nine entry graphs rerun. Before is the unchanged option-A S-only analysis; after uses the R cut. S and R columns are disjoint. Counts include structural holes and call-site instances, not runtime nodes or bytes. A server-owned parent with client slots is still counted client by the subtree metric; its server children are counted separately. These are placement candidates, not proof of frame transport or serialization.

| Twin | Before S holes | After S holes | R holes | Client holes | Before S JSX | After S JSX | R JSX | Client JSX |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| docs-yield | 124/243 (51.0%) | 133/243 (54.7%) | 56/243 (23.0%) | 54/243 (22.2%) | 148/249 (59.4%) | 151/249 (60.6%) | 61/249 (24.5%) | 37/249 (14.9%) |
| effect-yield | 2/77 (2.6%) | 2/77 (2.6%) | 0/77 (0.0%) | 75/77 (97.4%) | 22/76 (28.9%) | 22/76 (28.9%) | 0/76 (0.0%) | 54/76 (71.1%) |
| hackernews-spa-yield | 1/75 (1.3%) | 1/75 (1.3%) | 0/75 (0.0%) | 74/75 (98.7%) | 19/65 (29.2%) | 19/65 (29.2%) | 0/65 (0.0%) | 46/65 (70.8%) |
| rendering-yield | 47/203 (23.2%) | 47/203 (23.2%) | 0/203 (0.0%) | 156/203 (76.8%) | 66/153 (43.1%) | 66/153 (43.1%) | 0/153 (0.0%) | 87/153 (56.9%) |
| room-yield | 5/109 (4.6%) | 5/109 (4.6%) | 0/109 (0.0%) | 104/109 (95.4%) | 23/78 (29.5%) | 23/78 (29.5%) | 0/78 (0.0%) | 55/78 (70.5%) |
| sierpinski-yield | 2/18 (11.1%) | 2/18 (11.1%) | 0/18 (0.0%) | 16/18 (88.9%) | 0/2 (0.0%) | 0/2 (0.0%) | 0/2 (0.0%) | 2/2 (100.0%) |
| sierpinski-yield-h | 1/7 (14.3%) | 1/7 (14.3%) | 0/7 (0.0%) | 6/7 (85.7%) | 0/0 (0.0%) | 0/0 (0.0%) | 0/0 (0.0%) | 0/0 (0.0%) |
| todos-yield | 0/36 (0.0%) | 0/36 (0.0%) | 0/36 (0.0%) | 36/36 (100.0%) | 3/29 (10.3%) | 3/29 (10.3%) | 0/29 (0.0%) | 26/29 (89.7%) |
| todos-yield-h | 8/37 (21.6%) | 8/37 (21.6%) | 0/37 (0.0%) | 29/37 (78.4%) | 0/0 (0.0%) | 0/0 (0.0%) | 0/0 (0.0%) | 0/0 (0.0%) |

The h twins have no JSX sites. Their S/R/client h-element counts are sierpinski-yield-h: 0/0/2 of 2; todos-yield-h: 7/0/17 of 24.

### Regions, inputs and slots

**docs-yield.**

- SiteNav at examples/docs-yield/src/app.tsx:49:26: **S**, arguments [], slots [].
- ArticleContent at examples/docs-yield/src/app.tsx:17:17: **S**, arguments [], slots [].
- ArticleContent at examples/docs-yield/src/app.tsx:27:17: **R**, arguments [props.params.slug], slots [].
- ReadingGuide at examples/docs-yield/src/app.tsx:57:17: **S**, arguments [], slots [].
- SiteFooter at examples/docs-yield/src/app.tsx:58:17: **S**, arguments [], slots [].

**effect-yield.** No S/R loader region. No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C.

**hackernews-spa-yield.** No S/R loader region. No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C.

**rendering-yield.** No S/R loader region. No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C.

**room-yield.** No S/R loader region. The server-call results remain beneath client or unproved dependencies.

- Capture refused at examples/room-yield/src/routes/live.tsx:724:15: Server argument has no proved serializable shape.
- Capture refused at examples/room-yield/src/routes/live.tsx:743:13: Server argument has no proved serializable shape.

**sierpinski-yield.** No S/R loader region. No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C.

**sierpinski-yield-h.** No S/R loader region. No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C.

**todos-yield.** No S/R loader region. No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C.

**todos-yield-h.** No S/R loader region. No directly targeted declared server-function memo was found; async adapters/query/live wrappers stay U and event-written cells stay C.

Home's ArticleContent("overview") and ReadingGuide's ArticleContent("widgets") become entirely S, including their internal error fallback holes. DocPage's ArticleContent becomes R with the external argument vector [props.params.slug]; its default-to-overview expression stays on the server. Loaders, ArticleBody, chapter fields, table of contents and related links follow that placement. There is no article-list component in this version of Home. SiteNav and SiteFooter were already S.

The C3 Home/DocPage server wrapper places their sibling LikeButton in a slot keyed by route ownership plus the fixed LikeButton site (like#route-like), with serialized {slug}. No LikeButton is nested inside ArticleContent in this source. This report lists the narrower slot-free ArticleContent regions: wrapper/slot transport is established separately by the C3 integration tests, not by this analysis. See compiler-c3-server-components.md for its exact DOM differences. ThemeToggle, SearchBox, NewsletterForm, CommentList (including avatars), ImageCarousel, both LikeButton instances and the router shell remain client. C1's eleven dependency groups are preserved as the before grouping, not relabelled as eleven independently emitted R groups.

The old leak rows saying a client input remains U are still correct about the router/props producer. Their former implication that every downstream server-function result also stays client is superseded by C0 §1.2.
