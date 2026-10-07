# Sugar DX evidence: review inventory and 34 probe slots

2026-10-07. Companion to [sugar-design.md](../sugar-design.md).

## Provenance and limit

The task refers to four first-time-user reviews and 34 deliberate mistakes in
`documentation/reviews`. At `28ff9bb`, that directory held two code reviews and
the markless comparison, not those four first-use logs. `HANDOFF.md` points to
scratch workspaces. This branch archives the recovered logs without changing
their historical claims:

- [01-notes](first-use/01-notes.md): recovered from reviewer 3's `previous-log-1.md`;
  `/private/tmp/sy-review/log.md` no longer exists.
- [02-notes](first-use/02-notes.md): `/private/tmp/sy-review-2/log.md`.
- [03-kanban](first-use/03-kanban.md): `/private/tmp/sy-review-3/log.md`.
- [04-chat](first-use/04-chat.md): `/private/tmp/sy-review-4/log.md`.

Reviewer 3's “Deliberate-mistake probe” says **15 type, 7 lint, 12 runtime** and
“verbatim files kept only in my scratch”. The workspace and its final checkpoint
archive do not contain those files. The log names 11 type categories (counting
unbound/plain events separately), all seven lint categories, and nine runtime
categories including its N5 and unhandled-failure remarks. It does not establish
the original order, per-case source, or whether repeated variants occupy slots.

**Therefore this is a 34-slot coverage ledger, not a claim to have recovered or
rerun 34 original programs.** T/L/R identifiers below are new labels. Seven slots
remain unidentified. The named cases are schematic reconstructions from the
log; multiple rows can describe the same source tested at different layers.
No result from a missing case is counted as “caught”. F-S7 records this evidence
limit. The exact missing files would be needed for an exact 34-case score.

Both typing/editor routes are designs. Route 1's base mechanism (checking and
linting generated code) runs on todos; its LS mapping does not exist. Route 2's
color checker does not exist. “Would catch” below means a required outcome of
that route, not an executed test or an existing compiler message. Proposed local
messages are marked **proposed**; library codes/rule names are existing checks.

## Every complaint relevant to sugar

| Review/site                                                | Complaint                                                                                                   | Sugar effect / remaining work                                                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First use 1, items 6–7                                     | Guessing flow signatures; a row must return `view`, TS2589 plus backwards overload text                     | Row lowering inserts the view; sugar author does not learn this wrapper. Explicit source still keeps its existing rule.                                         |
| First use 1, items 8–9                                     | Double yield for a handler prop; five generic parameters for a sync event; confusing may-wait warning       | Read/call reconstruction removes double yield. `Handler` is still the useful contract. Sugar cannot change `P` versus an event's own async `A`.                 |
| First use 1, items 19–20                                   | Missing yields; tag/bind type errors mention brands; setup-read error is at `component`, twelve levels deep | Missing delegation/binding is generated. Tags stay refused. Mapped TS plus an origin trace must identify the read; removing `view` alone does not fix locality. |
| First use 1, item 21                                       | Missing Loading reported at another file's root with a misleading provider message                          | Current root code is already PENDING_ROOT. Both proposed editor routes add the originating read/call as a related location.                                     |
| First use 1, item 23                                       | `yield *` formatting and D-number/link noise                                                                | Sugar removes yield spelling from app code. A message catalogue/link policy is still separate work.                                                             |
| First use 2, F5 and final impression                       | Setup, holes, row views and contexts require care; too much ceremony for an everyday app                    | Wrappers disappear; host distinctions and required contexts remain. Sugar must explain illegal setup reads in source terms.                                     |
| First use 3, N1                                            | Effect compute colors the component; rejection is at foreign route registration in another file             | Keep the failure color; report the effect origin, intervening call chain, and foreign edge together. An inner view boundary cannot handle that effect.          |
| First use 3, probe and classification                      | Row JSX TS2589; unbound handler brands; setup-read overload; D-number noise                                 | Automatic row/bind lowering removes two mistakes; generated lint checks setup reads. The remaining type messages need mapped explanations.                      |
| First use 4, declaration inspections and source-array note | Source array has no path `.length`; `foreign` reports failure `any`; misleading hydration crash wrapper     | Sugar `messages().length` is clear, but cannot invent a missing source path or prove an `any` failure safe. Bootstrap/build-mode errors are unchanged.          |
| Code review Codex §4                                       | Nested call/generator/view form slows scanning; errors can point at `view`                                  | Sugar removes generators/views but retains call form. Source maps plus provenance are necessary for local errors.                                               |
| Code review Claude §4                                      | Components grew about 1.6–2.5×; call-form nesting; error locality                                           | These are historical measurements, not sugar measurements. The checked todos rewrite removes the extra routine layers. Room is still a design fixture.          |
| Markless comparison L6 (“idea #6”)                         | One consistent diagnostic shape, with cause, location, fix and docs                                         | Propose the same shared diagnostic objects for CLI, ESLint and LS. Route 1 still needs this; virtual files alone do not improve overload messages.              |

## The 34-slot table

`TS` means generated-code TypeScript for route 1 and ordinary value TypeScript
for route 2. `lint` is the full existing recommended set on generated code.
`compiler` means the proposed route-2 host/color checker. `dev` is the unchanged
runtime. Locations shown are proposed **source** locations; the prototype
currently reports generated locations. “Repaired” is intentional sugar syntax,
not a missed error. “Allowed” is not a missed error either (D-033).

| Slot | Mistake / schematic sugar source from named category       | Route 1: where and message                                                                                       | Route 2: where and message                                             | Evidence/status                                                                 |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| T01  | Yield component as `<Child />`                             | Generated TS tag refusal + `no-component-tag`; at tag, **proposed** “Call Child({…}) so its colors flow here.”   | Compiler at tag, same proposed message                                 | Named in log; sugar retains call form                                           |
| T02  | Setup `const n = count(); return <p>{n}</p>`               | TS SetupOp + `no-read-in-setup`; at `count()`, **proposed** “Read in JSX or a memo; setup runs once.”            | Compiler host check at read, same message                              | Named; current lint now covers what historical log lacked                       |
| T03  | Unbound `$event` in `onClick={save}`                       | Repaired to Bind; no error; hover includes failures/w                                                            | Repaired; checker records Bind colors                                  | Named; binding lowering tested                                                  |
| T04  | Plain event `onClick={() => set(1)}`                       | Transform refuses unknown reactive callback; otherwise generated TS `[BOUND]` / lint                             | Compiler at callback: **proposed** “Use $event for this handler.”      | Named; no automatic transaction invention                                       |
| T05  | `$effect(() => {})` with one phase                         | TS arity “Expected 2–3 arguments”; at call                                                                       | Value TS facade must retain two-phase signature; same location/message | Named; missing phase is not sugar                                               |
| T06  | `For({ each, children: item => <li>{item.title}</li> })`   | Repaired: row generator returns generated view                                                                   | Repaired, row colors join For                                          | Named; todos row reconstruction exact                                           |
| T07  | Pending component passed to root without Loading           | TS `[PENDING_ROOT]`; root plus related pending read; **proposed** “Wrap this pending part in Loading.”           | Compiler root check plus origin path; same code                        | Named; neither route may silently insert a boundary                             |
| T08  | Pending/failing source into settled prop                   | TS `[SETTLED_PROP]`; at prop assignment                                                                          | Compiler declared-prop color inclusion check there                     | Named; library contract must survive                                            |
| T09  | Invalid failure kind / nonnominal failure                  | TS `[FAILURE_KIND]`; at declaration/raise/attempt handler                                                        | Value TS nominal API check plus compiler summary validation            | Named; use `class E extends Failure("e") {}`                                    |
| T10  | Required context without distinct name                     | TS `[UNNAMED_CONTEXT]`; at createContext                                                                         | Value TS or compiler context declaration check there                   | Named; does not infer a unique identity from a variable spelling                |
| T11  | Eager JSX used as lazy children/fallback                   | Repaired for direct JSX prop: generate lazy callback; other invalid values retain `[LAZY_VIEW]`                  | Same lowering; compiler checks lazy edge                               | Named; no eager child moved across a boundary after it has already been created |
| T12  | Unidentified type probe                                    | Unknown; cannot state caught/missed/message                                                                      | Unknown                                                                | Missing original source                                                         |
| T13  | Unidentified type probe                                    | Unknown                                                                                                          | Unknown                                                                | Missing original source                                                         |
| T14  | Unidentified type probe                                    | Unknown                                                                                                          | Unknown                                                                | Missing original source                                                         |
| T15  | Unidentified type probe                                    | Unknown                                                                                                          | Unknown                                                                | Missing original source                                                         |
| L01  | `no-component-tag` case                                    | Same as T01; error at tag                                                                                        | Compiler tag check                                                     | All seven lint names recorded                                                   |
| L02  | `no-read-in-view-body`: local read before JSX              | Sugar has no authored view body; this becomes a forbidden setup read, T02                                        | Compiler host check at read                                            | Reinterpret position, do not rerun setup                                        |
| L03  | `no-unyielded-write`: `$event(() => { set(1); })`          | Repaired to delegated Receipt; no warning/error                                                                  | Same; records Write                                                    | Setter reconstruction tested                                                    |
| L04  | `no-unbound-event`: `onClick={save}`                       | Repaired to Bind                                                                                                 | Same; records bind-site E/w                                            | No failure color erased                                                         |
| L05  | `jsx-only-in-view`: JSX built into a setup local           | Generated lint; **proposed** “Return JSX directly; do not build it during setup.” Some shapes are prototype F-S4 | Compiler setup/JSX check at construction                               | Exact source absent; not every shape supported by prototype                     |
| L06  | `try { … } catch { … }` in a routine                       | Generated `no-try-catch`; at try, use `attempt`                                                                  | Compiler routine syntax rule; same fix                                 | Must not turn untyped catches into typed Failure handling                       |
| L07  | `component-children-generator`: ordinary children callback | Repaired in recognized lazy/row slot; unknown callback remains F-S1                                              | Same lowering, checker verifies callback role                          | Named; full arbitrary component callback contracts not implemented              |
| R01  | `[READ_IN_VIEW]`                                           | T02/L02 should stop it before dev; bypassed checks retain runtime refusal                                        | Host checker stops it; dev unchanged                                   | Named; generated wrapper must not conceal error                                 |
| R02  | `[UNYIELDED_WRITE]`                                        | Repaired in recognized routine; existing lint checks remaining discarded operations                              | Same lowering, compiler must reject unresolved writes                  | Named; no production silent no-op accepted as success                           |
| R03  | `[UNTYPED_THROW]`: plain throw in routine                  | `no-throw` before runtime; dev wrapper unchanged if bypassed                                                     | Compiler syntax check; dev unchanged                                   | Named; external unexpected crash is outside typed-failure theorem               |
| R04  | `[READ_IN_SETUP]`                                          | Generated TS + `no-read-in-setup`; runtime retained                                                              | Compiler host check; runtime retained                                  | Named; same setup count                                                         |
| R05  | `[WRITE_IN_REACTIVE]`: setter in memo                      | TS host admission + lint; at setter, **proposed** “Write in an event or effect phase.”                           | Compiler op admission there                                            | Named; does not silently turn memo into event                                   |
| R06  | `[CREATE_OUTSIDE_SETUP]`: signal creation in a hole        | TS ViewOp/HoleOp + lint; at constructor                                                                          | Compiler host check; same proposed location                            | Named; no automatic hoisting across lifetimes                                   |
| R07  | `[ASYNC_NOT_ALLOWED]`: wait in sync host                   | TS effect/compute admission; async routine syntax already SUGAR_ASYNC                                            | Compiler wait/host check; same refusal                                 | Named; ordinary external async work stays in attempt                            |
| R08  | N5: `[NO_PROVIDER]` for missing required context           | TS NO_PROVIDER at root/foreign edge with origin at context read; false `provided` claims still dev only          | Compiler requirement propagation; false external claims still dev only | Named by log reference to N5; current runtime names context                     |
| R09  | Typed event failure with no Errored (“nope!”)              | **Allowed at library root**; dev/runtime rethrows or rejects. Hover lists class; no static rejection             | Same; optional informational route trace, not an error                 | Named; D-033, not a checker miss                                                |
| R10  | Unidentified runtime probe                                 | Unknown; cannot state caught/missed/message                                                                      | Unknown                                                                | Missing original source                                                         |
| R11  | Unidentified runtime probe                                 | Unknown                                                                                                          | Unknown                                                                | Missing original source                                                         |
| R12  | Unidentified runtime probe                                 | Unknown                                                                                                          | Unknown                                                                | Missing original source                                                         |

The table cannot support “34/34 caught”. Its useful result is narrower: several
syntax mistakes disappear by construction, while host/order/boundary mistakes
remain and must still be checked. Dynamic disposal of a bound boundary (reviewer
3 N2) still needs D-109's runtime rejection; neither static route can prove every
possible interleaving. Hydration bootstrap, remote module loading and plain-Solid
crashes remain runtime/build concerns, not missing typed colors.


## Native mode: executed reconstructions (2026-10-08)

The native direction chooses virtual-code typing. Route 2 above is retained only
as historical design discussion; **no compiler-owned color checker is planned
in this prototype**. The native runner actually lowered each source below and,
when it emitted output, ran TypeScript and the full existing recommended lint.
These are reconstructed categories, not recovered verbatim historical probes.
The seven missing identities remain unavailable. A native rejection occurring
before a historical mistake is reached is an earlier refusal, not evidence that
that historical color error was detected.

[scripts/native/fixtures.mjs](../../scripts/native/fixtures.mjs) contains every
reconstructed source. [native-verification.json](../native-verification.json)
contains all exact messages, source/generated positions and emitted-check stages.
`node scripts/native-check.mjs` reruns and compares them. There is **no source
mapping for generated type/lint diagnostics yet**, and no editor plugin. Native
preflight messages use source positions; SUGAR_* messages may use intermediate
positions. Thus the “mapped back” part of the requested DX result is unfinished.

| Slot | Executed native fixture | Caught where / actual message excerpt | Interpretation |
| --- | --- | --- | --- |
| T01 | `tag` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| T02 | `setup-read` | type: `TS2769` — No overload matches this call.<br>lint: `solid-yield/no-read-in-setup` — [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event. | Generated location; source mapping planned |
| T03 | `named-event` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| T04 | `inline-event` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| T05 | `effect-arity` | transform: `NATIVE_EFFECT_PHASES` — createEffect needs a tracked compute and an untracked effect phase. | Refused before output |
| T06 | `row` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| T07 | `pending-root` | type: `TS1360` — Type 'HoleCall<{}, true, never, false, never>' does not satisfy the expected type '{ readonly "[PENDING_ROOT] the root may be pending (a read under it has no Loading above): wrap the root, render(() => Loading({ children: App }), el), or put a Loading around the pending part": true; }'. | PENDING_ROOT retained at the generated RootCheck handoff |
| T08 | `colored-prop` | type: `TS2322` — Type '() => Generator<Read<true, never>, number, any>' is not assignable to type 'number \| Source<number, never, false> \| SettledProp<"[SETTLED_PROP] prop `n` is settled: pass a settled value, or declare it Source<T, E, true>"> \| HoleProp<...>'. | Generated location; source mapping planned |
| T09 | `throw-error` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| T10 | `context` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| T11 | `lazy-child` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| T12 | Unavailable | Not run; historical source missing | Cannot claim caught or missed |
| T13 | Unavailable | Not run; historical source missing | Cannot claim caught or missed |
| T14 | Unavailable | Not run; historical source missing | Cannot claim caught or missed |
| T15 | Unavailable | Not run; historical source missing | Cannot claim caught or missed |
| L01 | `tag` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| L02 | `setup-read` | type: `TS2769` — No overload matches this call.<br>lint: `solid-yield/no-read-in-setup` — [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event. | Generated location; source mapping planned |
| L03 | `inline-event` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| L04 | `named-event` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| L05 | `eager-jsx` | type: `TS2769` — No overload matches this call.<br>lint: `solid-yield/jsx-only-in-view` — JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`). | Generated location; source mapping planned |
| L06 | `catch` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| L07 | `row` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| R01 | `setup-read` | type: `TS2769` — No overload matches this call.<br>lint: `solid-yield/no-read-in-setup` — [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event. | Generated location; source mapping planned |
| R02 | `inline-event` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| R03 | `throw-error` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| R04 | `setup-read` | type: `TS2769` — No overload matches this call.<br>lint: `solid-yield/no-read-in-setup` — [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event. | Generated location; source mapping planned |
| R05 | `memo-write` | type: `TS2345` — Argument of type '() => Generator<Read<false, never> \| Write, number, any>' is not assignable to parameter of type '() => Generator<MemoOp, number, any>'. | Generated location; source mapping planned |
| R06 | `hole-create` | transform: `SUGAR_CALLBACK` — [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (<root>/packages/vite-plugin-yield/test/.native-generated/hole-create.tsx:8:38) | Refused before output |
| R07 | `async-effect` | transform: `SUGAR_ASYNC` — [SUGAR_ASYNC] Use attempt inside a synchronous routine; async functions are not routines. (<root>/packages/vite-plugin-yield/test/.native-generated/async-effect.tsx:6:31) | Refused before output |
| R08 | `missing-context` | type: `TS2345` — Argument of type 'HoleCall<{}, false, never, false, RequiredContext<number, "<root>/packages/vite-plugin-yield/test/.native-generated/missing-context.tsx#C">>' is not assignable to parameter of type '(<A extends PropsInput<{}, unknown> = PropsInput<{}, never>>(props?: (A & NoInfer<Undeclared<A, {}>>) \| undefined) => ComponentView<false, never, false, RequiredContext<...> \| HoleRequires<...>>) & { ...; } & { ...; }'.<br>type: `TS1360` — Type 'HoleCall<{}, false, never, false, RequiredContext<number, "<root>/packages/vite-plugin-yield/test/.native-generated/missing-context.tsx#C">>' does not satisfy the expected type '{ readonly "[NO_PROVIDER] the root requires the contexts this property names: provide each above the components that read it (Ctx.provide({ value, children }) around their calls)": "<root>/packages/vite-plugin-yield/test/.native-generated/missing-context.tsx#C"; }'. | Generated location; source mapping planned |
| R09 | `unhandled-failure` | Generated TypeScript and lint: no diagnostics | Accepted generated form; no editor plugin |
| R10 | Unavailable | Not run; historical source missing | Cannot claim caught or missed |
| R11 | Unavailable | Not run; historical source missing | Cannot claim caught or missed |
| R12 | Unavailable | Not run; historical source missing | Cannot claim caught or missed |

The live run has **37 reconstructed fixtures, 21 accepted by generated
TS/lint**, plus two generated foreign-edge checks. It covers the **27 named
historical slots**; the seven missing original identities are still unavailable.
The new fixtures cover class/unknown memo failures, inline and named async events,
and a handled Promise rejection. Full messages and source are in the JSON record.

`class-memo` and `unknown-memo` both pass as library components. Passing their
generated component to `foreign` produces **TS2345** containing:

> [FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first

The named class ID appears for the first bridge; `unknown` appears for the second.
This is executed evidence that the unknown floor does not bypass D-033. Native
root R09 remains permitted. Pending-root T07 now reaches `[PENDING_ROOT]`, and
colored-prop T08 reaches `[SETTLED_PROP]`; neither is stopped by an obsolete
rejection refusal. NATIVE_FAILURE and NATIVE_REJECTION are removed.

Feedback termination is still not checked. The separate counter control supplies
SSR/hydrated parity; failure serialization has a production stream control.
Neither substitutes for the blocked complete-original parity runs. See the
Failure inference section of [sugar-design.md](../sugar-design.md) for F-S14/F-S15
on custom prototypes, selective catches and root exception identity.


Native follow-up: catches, rethrows, generator actions, stores, optimistic signals,
timer callbacks, array-map callbacks, latest/pending reads and onSettled now have
checked fixtures in `native-verification.json`. A rejecting generator action also
passes SSR and hydrated parity against its plain Solid control. Complete-original
parity is still unverified; no claim here turns those focused checks into app acceptance.

The additional `timer-callback-failure` probe reports TS2345 containing
`NATIVE_CALLBACK_FAILURE`. It prevents a generated foreign callback from dropping
its inferred unknown failure while callback-to-boundary registration is unfinished.
