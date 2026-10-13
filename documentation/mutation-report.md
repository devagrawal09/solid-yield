# Mutation report

Measured 2026-10-13T19:49:45.990Z. The corpus, operators and checker have changed since the first measurement (2026-10-08); each change is in its own commit, and the catalogue's corrections are listed below. The tests in scripts/mutation/test.mjs verify the harness, not the checker.

## Commands and scope

```sh
npm install --prefix scripts/mutation/tools --ignore-scripts
node --test scripts/mutation/test.mjs
node scripts/mutation/run.mjs
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-eslint.config.mjs
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-ts.config.mjs
```

Program run: 1367.9 seconds; 121 projects; 817 mutants. Digest: `2e524c9485c9c5a352f064cce2dda460fe1d8ce40ed03d46edac0c95139628de`.

Every syntactically applicable site is edited separately. Sources stay plain Solid. Each pipeline runs the shared native transform, the exported implementation used by `solid-yield check`, and recommended ESLint on generated code. A transform refusal blocks generated lint and is recorded explicitly. A CLI crash is a finding, never a kill.

Each mutant is read three ways. **Killed** (the gate's rule, since 2026-10-10): an expected diagnostic code whose primary or related location falls in the mutated routine, the top-level declaration holding the edit; for a deleted boundary (`delete-catch`, `delete-errored`, `delete-loading`, `delete-provider`; Dev's ruling, 2026-10-13) also an expected code the unmutated program did not report, wherever it is, since the checker reports the read or call the boundary covered, or one it reported that now lists more failure kinds. **Exact line** (the first measurement's rule, as originally requested): an expected code at the edited file and authored line (±0). **Detected**: an expected code the unmutated base program lacks, wherever it is reported; a removed Errored, Loading or provider is reported where the failure, pending read or requirement originates and at the root, never at the removed tag, so only this reading sees it. Generated lint uses the transform position table. Existing diagnostics in broken base programs count for the location rules; those matches are flagged in the JSON evidence (`preExistingMatch`). “Equivalent” means diagnostic-equivalent under the documented design, not identical runtime behavior; equivalent edits still run through the pipeline. Warnings are recorded; only a code in the expected set can kill or detect.

The gate runs `node scripts/mutation/run.mjs --cached --baseline documentation/yield-gate-baseline.json`. The cache hashes corpus content, mutation implementation, checker sources, library declarations/output and dependency lockfile. It is a local speed aid, not a committed result substitute: fresh checkouts run all pipelines. Any hashed change forces a fresh run. The gate checks the score and per-operator site floors. A checker change that raises the score is its own commit with its own tests; a catalogue change is listed as a correction.

## Program mutants

| Operator | Mutants | Equivalent | Killed | Survived | Score | Exact line | Detected | Expected codes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| delete-catch | 16 | 3 | 13 | 0 | 100.00% | 1 (7.69%) | 13 (100.00%) | FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS |
| swallow-catch | 1 | 1 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| delete-errored | 22 | 1 | 21 | 0 | 100.00% | 9 (42.86%) | 21 (100.00%) | FOREIGN_HANDOFF |
| delete-loading | 84 | 2 | 82 | 0 | 100.00% | 69 (84.15%) | 82 (100.00%) | PENDING_ROOT |
| setup-read | 234 | 0 | 234 | 0 | 100.00% | 234 (100.00%) | 234 (100.00%) | READ_IN_SETUP, solid-yield/no-read-in-setup |
| delete-provider | 11 | 1 | 10 | 0 | 100.00% | 0 (0.00%) | 10 (100.00%) | NO_PROVIDER |
| never-provided-context | 16 | 0 | 16 | 0 | 100.00% | 16 (100.00%) | 16 (100.00%) | NO_PROVIDER |
| throw-string | 18 | 18 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| throw-object | 18 | 18 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| async-reject | 10 | 8 | 2 | 0 | 100.00% | 1 (50.00%) | 2 (100.00%) | FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS |
| remove-await | 27 | 20 | 7 | 0 | 100.00% | 2 (28.57%) | 7 (100.00%) | TS2322, TS2345, TS2739, TS2740, TS2741, TS2339, GENERATED_TYPE, SETTLED_PROP |
| memo-write | 84 | 0 | 84 | 0 | 100.00% | 84 (100.00%) | 84 (100.00%) | WRITE_IN_REACTIVE, solid-yield/no-unyielded-write |
| timer-read | 6 | 6 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| non-core-cache | 95 | 0 | 95 | 0 | 100.00% | 12 (12.63%) | 95 (100.00%) | SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP, TS2322, TS2345, TS2739, TS2740, TS2741, TS2339, FOR_EACH |
| destructure-props | 18 | 0 | 18 | 0 | 100.00% | 17 (94.44%) | 18 (100.00%) | NATIVE_PROPS, NATIVE_RECURSION |
| inline-component | 27 | 0 | 27 | 0 | 100.00% | 27 (100.00%) | 27 (100.00%) | NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF |
| effect-arity | 2 | 0 | 2 | 0 | 100.00% | 2 (100.00%) | 2 (100.00%) | NATIVE_EFFECT_PHASES, TS2554 |
| remove-use-server | 1 | 1 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| callback-throw | 19 | 9 | 10 | 0 | 100.00% | 0 (0.00%) | 10 (100.00%) | FOREIGN_HANDOFF |
| server-new-class | 1 | 1 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | FOREIGN_HANDOFF |
| module-state | 18 | 0 | 18 | 0 | 100.00% | 18 (100.00%) | 18 (100.00%) | MODULE_STATE |
| create-in-hole | 89 | 0 | 89 | 0 | 100.00% | 88 (98.88%) | 89 (100.00%) | CREATE_OUTSIDE_SETUP |

**Program mutation score: 100.00% = 728 / (728 + 0).** 89 equivalents excluded. Exact line: 79.67% (580). Detected: 100.00% (728).

### Why mutants survive

Each survivor of the gate's rule falls in one category: **detected elsewhere** (an expected code the base lacks, outside the routine), **masked: base refused** (the unmutated program is already refused by the transform, which stops at its first refusal), **masked: base errors** (the base already has errors and the mutant adds none: a check suppressed by an earlier error, such as `FOREIGN_HANDOFF`'s "fix the earlier errors"), **different code** (new diagnostics, none expected), **silent** (no new diagnostic). A silent survivor on a clean base is either an equivalent edit the catalogue does not recognise or a missed check; the survivors list below has each one's diff.

| Operator | Detected elsewhere | Masked: base refused | Masked: base errors | Different code | Silent |
| --- | ---: | ---: | ---: | ---: | ---: |

### Catalogue and equivalent rules

- **delete-catch:** Remove one catch; retain try body and finally. Correction: EVENT_REJECTS added (2026-10-10): an event handler's unhandled failure is EVENT_REJECTS (sugar-design, unhandled rejections); NATIVE_CALLBACK_FAILURE is the foreign-callback code. Kill rule: Dev's ruling (2026-10-13): the defect a deleted boundary leaves is at the read or call it covered, which the checker reports there (with the root as related), not at the removed tag; an expected code the unmutated program did not report counts wherever it is, and so does one it reported that now lists more failure kinds (Dev, 2026-10-13: the Todos handler's report widened by a deleted catch).
- **swallow-catch:** Remove each direct rethrow in a catch. Equivalent reason: A catch may deliberately handle a failure. Removing a rethrow is permitted handling, not a checker error.
- **delete-errored:** Remove Errored tags, retain children. Kill rule: Dev's ruling (2026-10-13): the defect a deleted boundary leaves is at the read or call it covered, which the checker reports there (with the root as related), not at the removed tag; an expected code the unmutated program did not report counts wherever it is, and so does one it reported that now lists more failure kinds (Dev, 2026-10-13: the Todos handler's report widened by a deleted catch).
- **delete-loading:** Remove Loading tags, retain children. Kill rule: Dev's ruling (2026-10-13): the defect a deleted boundary leaves is at the read or call it covered, which the checker reports there (with the root as related), not at the removed tag; an expected code the unmutated program did not report counts wherever it is, and so does one it reported that now lists more failure kinds (Dev, 2026-10-13: the Todos handler's report widened by a deleted catch).
- **setup-read:** Hoist each signal/memo read from JSX or a memo to its enclosing component setup.
- **delete-provider:** Remove a locally declared context provider, retain children. Kill rule: Dev's ruling (2026-10-13): the defect a deleted boundary leaves is at the read or call it covered, which the checker reports there (with the root as related), not at the removed tag; an expected code the unmutated program did not report counts wherever it is, and so does one it reported that now lists more failure kinds (Dev, 2026-10-13: the Todos handler's report widened by a deleted catch).
- **never-provided-context:** Replace each context argument with a fresh context.
- **throw-string:** Replace each constructed class throw with a string. Equivalent reason: Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.
- **throw-object:** Replace each constructed class throw with an object. Equivalent reason: Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.
- **async-reject:** Insert throw new Error after each await statement in an async JSX event callback. Correction: EVENT_REJECTS added (2026-10-10): every site is an event handler, whose unhandled failure is EVENT_REJECTS; NATIVE_CALLBACK_FAILURE is the foreign-callback code.
- **remove-await:** Replace each await expression with its operand. Correction: TS2739, TS2740 and TS2741 added (2026-10-10): TypeScript's assignability error for missing properties (a Promise where its value was expected) is one of these, not TS2322. TS2339 added (2026-10-10, with the kept-promise fix): reading a property of the un-awaited Promise (`data.title`) is that error.
- **memo-write:** Insert a write to each visible signal setter in each memo callback.
- **timer-read:** Insert a settled signal read in each setup-time timer/listener callback. Equivalent reason: A settled signal read in an ignored timer/listener callback is an allowed event read. Failure diagnostics remain recorded.
- **non-core-cache:** Replace createMemo with an inline hand-rolled last-value cache, generic in the cached value's type. Correction: The cache is generic in the cached value (2026-10-12, Dev's ruling): typed `any`, it hid a cached promise from TypeScript and the checker alike, so a defect no type-based check can see. Over an async memo the generic cache leaves a promise (or a stream) where its value was expected, remove-await's defect; TypeScript's assignability and member errors for it are expected too, and FOR_EACH where the promise is a For's list (Solid's For fails on it).
- **destructure-props:** Destructure each directly read property in a component parameter; rewrite its references. Parameter snapshots are currently refused (setup snapshots are valid). Correction: NATIVE_RECURSION added (2026-10-12): in a recursive component the recursion lowering refuses the parameter snapshot first, at the caller whose prop stopped being a fixed number. It is the same refusal (a parameter snapshot) from an earlier stage; it had read as TRANSFORM at 1:1 until refusals kept their code and line.
- **inline-component:** Define an inline copy at every JSX use of a local component, and use that copy at the edited site. Other callers and exports remain valid.
- **effect-arity:** Remove all but the compute argument (or the only argument).
- **remove-use-server:** Remove each use server directive. Equivalent reason: Removing a server directive changes transport behavior but remains a valid local function; no checker error is required.
- **callback-throw:** Insert a conditional throw of a RangeError at the start of each callback given to an array method or to a module's own helper function, in a component's JSX hole or memo (F-S46, F-S47: the callback's failure is its host's).
- **server-new-class:** Replace each server-function throw with an instance of a fresh local class.
- **module-state:** Move a component's own signal or store (its initial value closing over nothing local) to module scope, where every render shares it.
- **create-in-hole:** Create a memo read once in JSX in that hole (`{createMemo(fn)()}`) instead of the component's setup.

### Site equivalents

Single sites read against their program and correct to accept (Dev's ruling, 2026-10-12). Each names its authored line; a changed line, or an entry matching no mutant or several, fails the run (`scripts/mutation/equivalents.mjs`).

- M0077 delete-catch at reviewer-m05_swallow/App.tsx:14: The Errored around List takes the failure the deleted catch absorbed.
- M0078 remove-await at reviewer-m05_swallow/App.tsx:14: `return fetchItems()` in an async function has the awaited form's type; the rejection leaves the try unabsorbed and reaches the same Errored.
- M0081 delete-errored at reviewer-m05_swallow/App.tsx:26: List's try/catch absorbs every failure under that boundary; nothing reaches the root.
- M0178 delete-provider at review-slots-context/App.tsx:8: The program renders nothing: App and Child are exported, so their requirement of C is their callers', as for any library component.
- M0179 delete-loading at review-slots-lazy-child/App.tsx:3: The boundary held static text; nothing below it waits.
- M0181 delete-catch at review-slots-catch/App.tsx:5: The try held a setter's call, which cannot fail.
- M0260 delete-loading at rendering-edges/Feed.tsx:56: The root's Loading (main.tsx, server.tsx) covers Feed; removing Feed's own moves the fallback.
- M0295 callback-throw at hole-edges/App.tsx:23: The throw is in the total memo's reduce callback; the memo is read only under the Errored, which takes it.
- M0192 delete-catch at operator-seeds/App.tsx:14: The deleted catch only rethrew: without it the failure leaves the same way.
- M0193 remove-await at operator-seeds/App.tsx:14: Unawaited, the rejection leaves the try without passing the catch, which only rethrew it; the async memo's type is the same.
- M0215 server-new-class at operator-seeds/server.ts:5: The throw cannot run (`if (false)`), and the Errored above the memo that reads the server takes a failure of any class.
- M0783 async-reject at surface-await/App.tsx:15: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0786 async-reject at surface-await/App.tsx:16: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0785 remove-await at surface-await/App.tsx:16: Unawaited, the promise is kept as a value (pushed to an `unknown[]`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs).
- M0796 async-reject at surface-await-json/App.tsx:15: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0798 async-reject at surface-await-json/App.tsx:16: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0797 remove-await at surface-await-json/App.tsx:16: Unawaited, the promise is kept as a value (assigned to `unknown`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs).
- M0816 async-reject at surface-await-loop/App.tsx:16: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0790 async-reject at surface-await-nested/App.tsx:15: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0789 remove-await at surface-await-nested/App.tsx:15: Unawaited, the promise is kept as a value (the outer one: the text promise pushed to an `unknown[]`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs).
- M0810 async-reject at surface-await-uncaught/App.tsx:15: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0806 async-reject at surface-promise-kept/App.tsx:16: The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler.
- M0805 remove-await at surface-promise-kept/App.tsx:16: Unawaited, the promise is kept as a value (the status promise pushed to an `unknown[]`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs).
- M0445 callback-throw at surface-callback-throw/App.tsx:12: The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see.
- M0455 callback-throw at surface-callback-reads-throw/App.tsx:12: The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see.
- M0466 callback-throw at surface-reduce-throw/App.tsx:12: The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see.
- M0495 callback-throw at surface-store-callback-throw/App.tsx:12: The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see.
- M0477 callback-throw at surface-callback-failing-call/App.tsx:12: The callback's JSON.parse already may throw; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see.

### Corpus provenance

The reviewer app and all 17 stored variants are verbatim snapshots under `scripts/mutation/corpus/reviewer`. They include all twelve numbered mistakes plus the boundary removals and throw variants. Historical programs come from `scripts/native/fixtures.mjs`: 18 reconstructed programs cover the 27 recoverable slots; T12–T15 and R10–R12 remain unavailable. The original two apps are read directly from their unchanged repository sources. The operator seeds ensure every operator has sites; the sugar-edges seed exercises the native edges added since (context hooks and members, setters in plain types, wrappers with boundaries around context readers, array callbacks, effect cleanups, an anonymous default component).


A program seeded with a deliberate mistake that the checker reports is a check of that mistake only (Dev's ruling, 2026-10-13): the checker stops at a refusal and holds some checks until earlier errors are fixed, so a second mistake on top could not show. Its mutants would repeat the clean reviewer app's.

| Project | Files | Base transform / CLI / lint | Mutated | Origin |
| --- | ---: | --- | --- | --- |
| sierpinski | 1 | completed / passed / passed | yes | examples/originals/sierpinski/src (verbatim) |
| todos | 5 | completed / diagnostics / diagnostics | yes | examples/originals/todos/src (verbatim) |
| reviewer-myapp | 3 | completed / passed / passed | yes | /private/tmp/sy-review-out/myapp/src (verbatim snapshot) |
| reviewer-m01_setup_read | 3 | completed / diagnostics / diagnostics | no: base check | /private/tmp/sy-review-out/variants/m01_setup_read.tsx (verbatim snapshot) |
| reviewer-m02_noprovider2 | 3 | completed / diagnostics / passed | no: base check | /private/tmp/sy-review-out/variants/m02_noprovider2.tsx (verbatim snapshot) |
| reviewer-m03_throw_string | 3 | refused / diagnostics / blocked-by-transform | no: base check | /private/tmp/sy-review-out/variants/m03_throw_string.tsx (verbatim snapshot) |
| reviewer-m03b_throw_in_memo | 3 | refused / diagnostics / blocked-by-transform | no: base check | /private/tmp/sy-review-out/variants/m03b_throw_in_memo.tsx (verbatim snapshot) |
| reviewer-m03c_throw_in_handler | 3 | completed / diagnostics / passed | no: base check | /private/tmp/sy-review-out/variants/m03c_throw_in_handler.tsx (verbatim snapshot) |
| reviewer-m04_async_handler | 3 | completed / diagnostics / passed | no: base check | /private/tmp/sy-review-out/variants/m04_async_handler.tsx (verbatim snapshot) |
| reviewer-m05_swallow | 3 | completed / passed / passed | yes | /private/tmp/sy-review-out/variants/m05_swallow.tsx (verbatim snapshot) |
| reviewer-m06_memo_writes | 3 | completed / diagnostics / passed | no: base check | /private/tmp/sy-review-out/variants/m06_memo_writes.tsx (verbatim snapshot) |
| reviewer-m07_timeout_read | 3 | completed / passed / passed | yes | /private/tmp/sy-review-out/variants/m07_timeout_read.tsx (verbatim snapshot) |
| reviewer-m08_portal | 3 | completed / passed / passed | yes | /private/tmp/sy-review-out/variants/m08_portal.tsx (verbatim snapshot) |
| reviewer-m09_destructure | 3 | refused / diagnostics / blocked-by-transform | no: base check | /private/tmp/sy-review-out/variants/m09_destructure.tsx (verbatim snapshot) |
| reviewer-m10_conditional | 3 | completed / passed / passed | yes | /private/tmp/sy-review-out/variants/m10_conditional.tsx (verbatim snapshot) |
| reviewer-m11_nested_comp | 3 | completed / passed / diagnostics | yes | /private/tmp/sy-review-out/variants/m11_nested_comp.tsx (verbatim snapshot) |
| reviewer-m12_effect_arity | 3 | refused / diagnostics / blocked-by-transform | no: base check | /private/tmp/sy-review-out/variants/m12_effect_arity.tsx (verbatim snapshot) |
| reviewer-s2a_noloading | 3 | completed / diagnostics / passed | no: base check | /private/tmp/sy-review-out/variants/s2a_noloading.tsx (verbatim snapshot) |
| reviewer-s2b_noprovider | 3 | completed / diagnostics / passed | no: base check | /private/tmp/sy-review-out/variants/s2b_noprovider.tsx (verbatim snapshot) |
| reviewer-s2c_noerrored | 3 | completed / diagnostics / passed | no: base check | /private/tmp/sy-review-out/variants/s2c_noerrored.tsx (verbatim snapshot) |
| review-slots-tag | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots T01, L01 |
| review-slots-setup-read | 1 | completed / diagnostics / diagnostics | no: base check | scripts/native/fixtures.mjs; reconstructed slots T02, L02, R01, R04 |
| review-slots-named-event | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots T03, L04 |
| review-slots-inline-event | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots T04, L03, R02 |
| review-slots-effect-arity | 1 | refused / diagnostics / blocked-by-transform | no: base check | scripts/native/fixtures.mjs; reconstructed slots T05 |
| review-slots-row | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots T06, L07 |
| review-slots-pending-root | 1 | completed / diagnostics / passed | no: base check | scripts/native/fixtures.mjs; reconstructed slots T07 |
| review-slots-colored-prop | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots T08 |
| review-slots-throw-error | 1 | completed / diagnostics / passed | no: base check | scripts/native/fixtures.mjs; reconstructed slots T09, R03 |
| review-slots-context | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots T10 |
| review-slots-lazy-child | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots T11 |
| review-slots-eager-jsx | 1 | completed / diagnostics / diagnostics | no: base check | scripts/native/fixtures.mjs; reconstructed slots L05 |
| review-slots-catch | 1 | completed / passed / passed | yes | scripts/native/fixtures.mjs; reconstructed slots L06 |
| review-slots-memo-write | 1 | completed / diagnostics / passed | no: base check | scripts/native/fixtures.mjs; reconstructed slots R05 |
| review-slots-hole-create | 1 | completed / diagnostics / passed | no: base check | scripts/native/fixtures.mjs; reconstructed slots R06 |
| review-slots-async-effect | 1 | refused / diagnostics / blocked-by-transform | no: base check | scripts/native/fixtures.mjs; reconstructed slots R07 |
| review-slots-missing-context | 1 | completed / diagnostics / passed | no: base check | scripts/native/fixtures.mjs; reconstructed slots R08 |
| review-slots-unhandled-failure | 1 | completed / diagnostics / passed | no: base check | scripts/native/fixtures.mjs; reconstructed slots R09 |
| operator-seeds | 2 | completed / passed / passed | yes | Additional plain Solid controls for catch, async event and server sites |
| sugar-edges | 4 | completed / passed / passed | yes | Plain Solid exercising the native edges: context hooks and members, setters in plain types, wrappers with boundaries around context readers, array callbacks, effect cleanups, an anonymous default component |
| rendering-edges | 5 | completed / passed / passed | yes | Plain Solid exercising Rendering's native edges: a component factory with a tuple context and destructured members, a derived store, async iterable producers, a Repeat index key, isPending thunks, a lazy page, root trees (CSR, and a server function's with a ParentProps shell) |
| effect-edges | 4 | completed / passed / passed | yes | Plain Solid exercising Effect's native edges (D-121, D-122): a saga its driver steps inside an action, a kept action promise, a provider value that creates, cleans up and may fail, an accessor prop, a store's root in For, a store reduce, a routine's stream a memo returns |
| hole-edges | 2 | completed / passed / passed | yes | Plain Solid exercising failing calls in JSX holes (nativeHole) and values typed any: a helper that may throw in a hole, in an attribute and in a row under an Errored; a context, a store, a signal and a memo of any, with a method of any |
| surface-plain | 1 | completed / passed / passed | yes | scripts/native-surface: the `plain` form in a memo of a rendered app |
| surface-ternary | 1 | completed / passed / passed | yes | scripts/native-surface: the `ternary` form in a memo of a rendered app |
| surface-logical-and | 1 | completed / passed / passed | yes | scripts/native-surface: the `logical-and` form in a memo of a rendered app |
| surface-logical-or | 1 | completed / passed / passed | yes | scripts/native-surface: the `logical-or` form in a memo of a rendered app |
| surface-nullish | 1 | completed / passed / passed | yes | scripts/native-surface: the `nullish` form in a memo of a rendered app |
| surface-optional-chain | 1 | completed / passed / passed | yes | scripts/native-surface: the `optional-chain` form in a memo of a rendered app |
| surface-template | 1 | completed / passed / passed | yes | scripts/native-surface: the `template` form in a memo of a rendered app |
| surface-tagged-template | 1 | completed / passed / passed | yes | scripts/native-surface: the `tagged-template` form in a memo of a rendered app |
| surface-array-literal | 1 | completed / passed / passed | yes | scripts/native-surface: the `array-literal` form in a memo of a rendered app |
| surface-object-literal | 1 | completed / passed / passed | yes | scripts/native-surface: the `object-literal` form in a memo of a rendered app |
| surface-array-spread | 1 | completed / passed / passed | yes | scripts/native-surface: the `array-spread` form in a memo of a rendered app |
| surface-object-spread | 1 | completed / passed / passed | yes | scripts/native-surface: the `object-spread` form in a memo of a rendered app |
| surface-destructure-object | 1 | completed / passed / passed | yes | scripts/native-surface: the `destructure-object` form in a memo of a rendered app |
| surface-destructure-array | 1 | completed / passed / passed | yes | scripts/native-surface: the `destructure-array` form in a memo of a rendered app |
| surface-destructure-default | 1 | completed / passed / passed | yes | scripts/native-surface: the `destructure-default` form in a memo of a rendered app |
| surface-map | 1 | completed / passed / passed | yes | scripts/native-surface: the `map` form in a memo of a rendered app |
| surface-filter | 1 | completed / passed / passed | yes | scripts/native-surface: the `filter` form in a memo of a rendered app |
| surface-reduce | 1 | completed / passed / passed | yes | scripts/native-surface: the `reduce` form in a memo of a rendered app |
| surface-find | 1 | completed / passed / passed | yes | scripts/native-surface: the `find` form in a memo of a rendered app |
| surface-some-every | 1 | completed / passed / passed | yes | scripts/native-surface: the `some-every` form in a memo of a rendered app |
| surface-sort-copy | 1 | completed / passed / passed | yes | scripts/native-surface: the `sort-copy` form in a memo of a rendered app |
| surface-callback-throw | 1 | completed / passed / passed | yes | scripts/native-surface: the `callback-throw` form in a memo of a rendered app |
| surface-callback-reads-throw | 1 | completed / passed / passed | yes | scripts/native-surface: the `callback-reads-throw` form in a memo of a rendered app |
| surface-reduce-throw | 1 | completed / passed / passed | yes | scripts/native-surface: the `reduce-throw` form in a memo of a rendered app |
| surface-callback-failing-call | 1 | completed / passed / passed | yes | scripts/native-surface: the `callback-failing-call` form in a memo of a rendered app |
| surface-comparator-throw | 1 | completed / passed / passed | yes | scripts/native-surface: the `comparator-throw` form in a memo of a rendered app |
| surface-store-callback-throw | 1 | completed / passed / passed | yes | scripts/native-surface: the `store-callback-throw` form in a memo of a rendered app |
| surface-for-each | 1 | completed / passed / passed | yes | scripts/native-surface: the `for-each` form in a memo of a rendered app |
| surface-for-of | 1 | completed / passed / passed | yes | scripts/native-surface: the `for-of` form in a memo of a rendered app |
| surface-for-in | 1 | completed / passed / passed | yes | scripts/native-surface: the `for-in` form in a memo of a rendered app |
| surface-for-index | 1 | completed / passed / passed | yes | scripts/native-surface: the `for-index` form in a memo of a rendered app |
| surface-while | 1 | completed / passed / passed | yes | scripts/native-surface: the `while` form in a memo of a rendered app |
| surface-do-while | 1 | completed / passed / passed | yes | scripts/native-surface: the `do-while` form in a memo of a rendered app |
| surface-labeled-continue | 1 | completed / passed / passed | yes | scripts/native-surface: the `labeled-continue` form in a memo of a rendered app |
| surface-switch | 1 | completed / passed / passed | yes | scripts/native-surface: the `switch` form in a memo of a rendered app |
| surface-if-else | 1 | completed / passed / passed | yes | scripts/native-surface: the `if-else` form in a memo of a rendered app |
| surface-try-catch | 1 | completed / passed / passed | yes | scripts/native-surface: the `try-catch` form in a memo of a rendered app |
| surface-try-finally | 1 | completed / passed / passed | yes | scripts/native-surface: the `try-finally` form in a memo of a rendered app |
| surface-iife | 1 | completed / passed / passed | yes | scripts/native-surface: the `iife` form in a memo of a rendered app |
| surface-local-arrow | 1 | completed / passed / passed | yes | scripts/native-surface: the `local-arrow` form in a memo of a rendered app |
| surface-local-function | 1 | completed / passed / passed | yes | scripts/native-surface: the `local-function` form in a memo of a rendered app |
| surface-closure-read | 1 | completed / passed / passed | yes | scripts/native-surface: the `closure-read` form in a memo of a rendered app |
| surface-typeof-instanceof | 1 | completed / passed / passed | yes | scripts/native-surface: the `typeof-instanceof` form in a memo of a rendered app |
| surface-in-operator | 1 | completed / passed / passed | yes | scripts/native-surface: the `in-operator` form in a memo of a rendered app |
| surface-casts | 1 | completed / passed / passed | yes | scripts/native-surface: the `casts` form in a memo of a rendered app |
| surface-string-methods | 1 | completed / passed / passed | yes | scripts/native-surface: the `string-methods` form in a memo of a rendered app |
| surface-math | 1 | completed / passed / passed | yes | scripts/native-surface: the `math` form in a memo of a rendered app |
| surface-object-statics | 1 | completed / passed / passed | yes | scripts/native-surface: the `object-statics` form in a memo of a rendered app |
| surface-map-set | 1 | completed / passed / passed | yes | scripts/native-surface: the `map-set` form in a memo of a rendered app |
| surface-date | 1 | completed / passed / passed | yes | scripts/native-surface: the `date` form in a memo of a rendered app |
| surface-regex | 1 | completed / passed / passed | yes | scripts/native-surface: the `regex` form in a memo of a rendered app |
| surface-optional-call | 1 | completed / passed / passed | yes | scripts/native-surface: the `optional-call` form in a memo of a rendered app |
| surface-compound-assign | 1 | completed / passed / passed | yes | scripts/native-surface: the `compound-assign` form in a memo of a rendered app |
| surface-increment | 1 | completed / passed / passed | yes | scripts/native-surface: the `increment` form in a memo of a rendered app |
| surface-exponent-bitwise | 1 | completed / passed / passed | yes | scripts/native-surface: the `exponent-bitwise` form in a memo of a rendered app |
| surface-bigint | 1 | completed / passed / passed | yes | scripts/native-surface: the `bigint` form in a memo of a rendered app |
| surface-string-concat | 1 | completed / passed / passed | yes | scripts/native-surface: the `string-concat` form in a memo of a rendered app |
| surface-array-from | 1 | completed / passed / passed | yes | scripts/native-surface: the `array-from` form in a memo of a rendered app |
| surface-store-path | 1 | completed / passed / passed | yes | scripts/native-surface: the `store-path` form in a memo of a rendered app |
| surface-store-list | 1 | completed / passed / passed | yes | scripts/native-surface: the `store-list` form in a memo of a rendered app |
| surface-json-stringify | 1 | completed / passed / passed | yes | scripts/native-surface: the `json-stringify` form in a memo of a rendered app |
| surface-class-instance | 1 | completed / passed / passed | yes | scripts/native-surface: the `class-instance` form in a memo of a rendered app |
| surface-getter-object | 1 | completed / passed / passed | yes | scripts/native-surface: the `getter-object` form in a memo of a rendered app |
| surface-user-generator | 1 | completed / passed / passed | yes | scripts/native-surface: the `user-generator` form in a memo of a rendered app |
| surface-object-method | 1 | completed / passed / passed | yes | scripts/native-surface: the `object-method` form in a memo of a rendered app |
| surface-getter-this | 1 | completed / passed / passed | yes | scripts/native-surface: the `getter-this` form in a memo of a rendered app |
| surface-class-method | 1 | completed / passed / passed | yes | scripts/native-surface: the `class-method` form in a memo of a rendered app |
| surface-reader-helper | 1 | completed / passed / passed | yes | scripts/native-surface: the `reader-helper` form in a memo of a rendered app |
| surface-untrack | 1 | completed / passed / passed | yes | scripts/native-surface: the `untrack` form in a memo of a rendered app |
| surface-comma-sequence | 1 | completed / passed / passed | yes | scripts/native-surface: the `comma-sequence` form in a memo of a rendered app |
| surface-nested-ternary-template | 1 | completed / passed / passed | yes | scripts/native-surface: the `nested-ternary-template` form in a memo of a rendered app |
| surface-await | 1 | completed / passed / diagnostics | yes | scripts/native-surface: the `await` form in a memo of a rendered app |
| surface-await-nested | 1 | completed / passed / diagnostics | yes | scripts/native-surface: the `await-nested` form in a memo of a rendered app |
| surface-await-json | 1 | completed / passed / diagnostics | yes | scripts/native-surface: the `await-json` form in a memo of a rendered app |
| surface-promise-then | 1 | completed / passed / diagnostics | yes | scripts/native-surface: the `promise-then` form in a memo of a rendered app |
| surface-promise-kept | 1 | completed / passed / diagnostics | yes | scripts/native-surface: the `promise-kept` form in a memo of a rendered app |
| surface-await-uncaught | 1 | completed / passed / diagnostics | yes | scripts/native-surface: the `await-uncaught` form in a memo of a rendered app |
| surface-await-loop | 1 | completed / passed / diagnostics | yes | scripts/native-surface: the `await-loop` form in a memo of a rendered app |

## Checker mutants (Stryker)

Stryker 10.0.0 uses the JavaScript mutator. This is the requested bounded fallback: full runs over the two smallest checker packages by source line count (TypeScript plugin: 536; ESLint plugin: 2,213). Vite native/sugar/transform/position code (4,206 package lines) and compiler inference (inside a 4,236-line package) were not Stryker-tested here. Their program-pipeline execution does not replace checker mutation testing. No partial or sampled score is presented as a full score.

ESLint uses its unchanged 238-test Vitest suite. The TypeScript plugin uses its unchanged 19-test node:test suite through a registration adapter. The adapter changes the test host, not assertions. Stryker comment insertion is disabled because it shifts fixture source lines. Stryker reports retain covered/killed test identities. CLI/tsserver subprocess coverage does not return to the parent Vitest runner; NoCoverage is a coverage-collection limit at those edges, not proof the code never executes. Scores follow Stryker: (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage). Runtime/compile errors are listed separately, not counted as kills.

| Package | Mutants | Killed | Timeout | Survived | No coverage | Runtime / compile errors | Score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| eslint-plugin-yield | 3145 | 2060 | 17 | 851 | 217 | 0 | 66.04% |
| ts-plugin-yield | 699 | 331 | 5 | 213 | 150 | 0 | 48.07% |

- eslint-plugin-yield: `node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-eslint.config.mjs`; 2026-10-08T13:15:21.000Z → 2026-10-08T13:44:37.133Z; 1756s; exit 0.

- ts-plugin-yield: `node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-ts.config.mjs`; 2026-10-08T13:29:31.802Z → 2026-10-08T14:26:09.482Z; 3398s; exit 0.

[Stryker configuration reference](https://stryker-mutator.io/docs/stryker-js/configuration/). Local socket access was needed for its workers. A first install hit a pnpm-store mismatch; isolated tools avoid changing the workspace dependency tree. The pinned local pnpm is available for build/gate commands.

### Top 20 surviving checker mutants

These are observed surviving changes; the reason states what the run can prove. It does not claim a detailed root cause without a follow-up test.

#### F-C1: packages/eslint-plugin-yield/src/calls.js:23 (Survived, ConditionalExpression)

```diff
- !type || seen.has(type)
+ false
```

11 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 152, 154, 155, 157, 158, 159, 212, 215, 216, 217, 218.

#### F-C2: packages/eslint-plugin-yield/src/calls.js:23 (Survived, LogicalOperator)

```diff
- !type || seen.has(type)
+ !type && seen.has(type)
```

11 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 152, 154, 155, 157, 158, 159, 212, 215, 216, 217, 218.

#### F-C3: packages/eslint-plugin-yield/src/calls.js:25 (Survived, ConditionalExpression)

```diff
- type.isUnionOrIntersection && type.isUnionOrIntersection()
+ false
```

11 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 152, 154, 155, 157, 158, 159, 212, 215, 216, 217, 218.

#### F-C4: packages/eslint-plugin-yield/src/calls.js:37 (Survived, ConditionalExpression)

```diff
- !type || seen.has(type)
+ false
```

11 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 152, 154, 155, 157, 158, 159, 212, 215, 216, 217, 218.

#### F-C5: packages/eslint-plugin-yield/src/calls.js:37 (Survived, LogicalOperator)

```diff
- !type || seen.has(type)
+ !type && seen.has(type)
```

11 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 152, 154, 155, 157, 158, 159, 212, 215, 216, 217, 218.

#### F-C6: packages/eslint-plugin-yield/src/calls.js:39 (Survived, ConditionalExpression)

```diff
- type.isUnionOrIntersection && type.isUnionOrIntersection()
+ false
```

11 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 152, 154, 155, 157, 158, 159, 212, 215, 216, 217, 218.

#### F-C7: packages/eslint-plugin-yield/src/calls.js:56 (Survived, ConditionalExpression)

```diff
- tsNode
+ true
```

11 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 152, 154, 155, 157, 158, 159, 212, 215, 216, 217, 218.

#### F-C8: packages/eslint-plugin-yield/src/calls.js:61 (Survived, ConditionalExpression)

```diff
- node.type === "JSXIdentifier" || node.type === "Identifier"
+ true
```

28 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 53, 54, 56, 57, 58, 59, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 78, 80, 81, 82, 83, 204, 206, 207, 208, 209, 210.

#### F-C9: packages/eslint-plugin-yield/src/calls.js:62 (Survived, ConditionalExpression)

```diff
- !name
+ false
```

28 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 53, 54, 56, 57, 58, 59, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 78, 80, 81, 82, 83, 204, 206, 207, 208, 209, 210.

#### F-C10: packages/eslint-plugin-yield/src/calls.js:67 (Survived, ConditionalExpression)

```diff
- def.parent.importKind !== "type"
+ true
```

12 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 57, 59, 64, 65, 66, 67, 69, 70, 71, 72, 81, 83.

#### F-C11: packages/eslint-plugin-yield/src/calls.js:72 (Survived, ConditionalExpression)

```diff
- init.callee.type === "Identifier"
+ true
```

12 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 58, 63, 68, 80, 81, 82, 206, 207, 208, 209, 210.

#### F-C12: packages/eslint-plugin-yield/src/calls.js:73 (Survived, ConditionalExpression)

```diff
- init.callee.name === "component" || init.callee.name === "lazy"
+ true
```

12 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 58, 63, 68, 80, 81, 82, 206, 207, 208, 209, 210.

#### F-C13: packages/eslint-plugin-yield/src/calls.js:84 (Survived, ConditionalExpression)

```diff
- p.type !== "ArrowFunctionExpression"
+ true
```

23 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 77, 78, 80, 81, 82, 83, 109, 154, 155, 157, 158, 159, 166, 167, 168, 169, 170, 173, 174.

#### F-C14: packages/eslint-plugin-yield/src/calls.js:94 (Survived, ConditionalExpression)

```diff
- found || !n || typeof n.type !== "string"
+ false
```

6 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 63, 155.

#### F-C15: packages/eslint-plugin-yield/src/calls.js:94 (Survived, LogicalOperator)

```diff
- found || !n || typeof n.type !== "string"
+ (found || !n) && typeof n.type !== "string"
```

6 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 63, 155.

#### F-C16: packages/eslint-plugin-yield/src/calls.js:94 (Survived, ConditionalExpression)

```diff
- found || !n
+ false
```

6 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 63, 155.

#### F-C17: packages/eslint-plugin-yield/src/calls.js:94 (Survived, LogicalOperator)

```diff
- found || !n
+ found && !n
```

6 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 63, 155.

#### F-C18: packages/eslint-plugin-yield/src/calls.js:94 (Survived, ConditionalExpression)

```diff
- typeof n.type !== "string"
+ false
```

6 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 63, 155.

#### F-C19: packages/eslint-plugin-yield/src/calls.js:95 (Survived, ConditionalExpression)

```diff
- n !== node && /Function/.test(n.type)
+ false
```

6 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 63, 155.

#### F-C20: packages/eslint-plugin-yield/src/calls.js:95 (Survived, ConditionalExpression)

```diff
- n !== node
+ true
```

6 covering test(s) observed the location; none failed with this change. The assertions do not distinguish this changed behavior.

Covered test IDs: 56, 57, 58, 59, 63, 155.

## Program survivors and findings

Each surviving mutant below is its own F-M finding for the next session. A survivor is a finding under this catalogue and locality rule, not automatically a soundness bug: follow-up must distinguish valid edits, root-location diagnostics, wrong codes, and missing checks. Messages are the full CLI output plus generated-lint/transform diagnostics, with temporary paths normalized. No output means no diagnostic, not a passed behavioral test.

## Findings list

- F-M1–F-M0: 0 survivors of the gate's rule, each with its category, full diff and actual diagnostics above.
- F-C1–F-C20: the top checker survivors above; remaining survivors stay in the raw Stryker reports.
- F-MAP: 0 mutant CLI crashes; the current position/error mapping can throw instead of returning diagnostics. IDs: none.
- F-SCOPE: Vite native/sugar/transform/positions and compiler inference still need full checker-mutant runs. The full command-runner configuration is checked in.
- F-COVERAGE: The Vitest adapter does not collect CLI/tsserver subprocess coverage. NoCoverage there may be a runner limit, not an absent test. The full command runner avoids coverage-based selection.
- F-TIMEOUT: Stryker includes timeouts as detected. They need follow-up to distinguish loops from slow runs under contention.
- F-HISTORY: Seven historical review identities remain unavailable; 27/34 reconstructed slots are covered.
- F-BOUNDARY-LOCALITY: Removing a wrapper or provider reports a valid boundary error at the failure's origin and the root, not at the edit. Those survive both location rules and count as detected.

## Build and gate verification

Each local commit was preceded by pnpm build and a full gate against documentation/yield-gate-baseline.json. Successful full runs:
- 65 pass / 0 fail / 0 skip in 699s; --jobs 1; head d88e31c.
- 65 pass / 0 fail / 0 skip in 521s; --jobs 2; head 67dd7d7.
- 65 pass / 0 fail / 0 skip in 520s; --jobs 2; head 09c800a.

The first concurrent gate attempt had one unchanged Sierpinski animation-frame test exceed its 5-second timeout; the complete reruns passed. No test timeout, existing gate entry, or checker source was changed. Only the mutation step and initial score/site floors were added to the baseline. Literal unified diffs retain blank context-line prefixes; those intentional spaces can trigger the default Git whitespace check.
