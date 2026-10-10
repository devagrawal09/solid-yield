# Mutation report

Measured 2026-10-10T14:31:34.661Z. The corpus, operators and checker have changed since the first measurement (2026-10-08); each change is in its own commit, and the catalogue's corrections are listed below. The tests in scripts/mutation/test.mjs verify the harness, not the checker.

## Commands and scope

```sh
npm install --prefix scripts/mutation/tools --ignore-scripts
node --test scripts/mutation/test.mjs
node scripts/mutation/run.mjs
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-eslint.config.mjs
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-ts.config.mjs
```

Program run: 2790.3 seconds; 41 projects; 470 mutants. Digest: `70c0b52335446e4de488b3c0b487ab358701bad0bc5b6829d98dacb9b7dca3df`.

Every syntactically applicable site is edited separately. Sources stay plain Solid. Each pipeline runs the shared native transform, the exported implementation used by `solid-yield check`, and recommended ESLint on generated code. A transform refusal blocks generated lint and is recorded explicitly. A CLI crash is a finding, never a kill.

Each mutant is read three ways. **Killed** (the gate's rule, since 2026-10-10): an expected diagnostic code whose primary or related location falls in the mutated routine, the top-level declaration holding the edit. **Exact line** (the first measurement's rule, as originally requested): an expected code at the edited file and authored line (±0). **Detected**: an expected code the unmutated base program lacks, wherever it is reported; a removed Errored, Loading or provider is reported where the failure, pending read or requirement originates and at the root, never at the removed tag, so only this reading sees it. Generated lint uses the transform position table. Existing diagnostics in broken base programs count for the location rules; those matches are flagged in the JSON evidence (`preExistingMatch`). “Equivalent” means diagnostic-equivalent under the documented design, not identical runtime behavior; equivalent edits still run through the pipeline. Warnings are recorded; only a code in the expected set can kill or detect.

The gate runs `node scripts/mutation/run.mjs --cached --baseline documentation/yield-gate-baseline.json`. The cache hashes corpus content, mutation implementation, checker sources, library declarations/output and dependency lockfile. It is a local speed aid, not a committed result substitute: fresh checkouts run all pipelines. Any hashed change forces a fresh run. The gate checks the score and per-operator site floors. A checker change that raises the score is its own commit with its own tests; a catalogue change is listed as a correction.

## Program mutants

| Operator | Mutants | Equivalent | Killed | Survived | Score | Exact line | Detected | Expected codes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| delete-catch | 9 | 0 | 2 | 7 | 22.22% | 1 (11.11%) | 5 (55.56%) | FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS |
| swallow-catch | 2 | 2 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| delete-errored | 22 | 0 | 2 | 20 | 9.09% | 0 (0.00%) | 12 (54.55%) | FOREIGN_HANDOFF |
| delete-loading | 25 | 0 | 3 | 22 | 12.00% | 0 (0.00%) | 17 (68.00%) | PENDING_ROOT |
| setup-read | 117 | 0 | 96 | 21 | 82.05% | 96 (82.05%) | 96 (82.05%) | READ_IN_SETUP, solid-yield/no-read-in-setup |
| delete-provider | 22 | 0 | 0 | 22 | 0.00% | 0 (0.00%) | 15 (68.18%) | NO_PROVIDER |
| never-provided-context | 28 | 0 | 24 | 4 | 85.71% | 24 (85.71%) | 24 (85.71%) | NO_PROVIDER |
| throw-string | 27 | 27 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| throw-object | 27 | 27 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| async-reject | 3 | 0 | 3 | 0 | 100.00% | 1 (33.33%) | 2 (66.67%) | FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS |
| remove-await | 31 | 27 | 2 | 2 | 50.00% | 1 (25.00%) | 2 (50.00%) | TS2322, TS2345, TS2739, TS2740, TS2741, TS2339, GENERATED_TYPE, SETTLED_PROP |
| memo-write | 25 | 0 | 21 | 4 | 84.00% | 21 (84.00%) | 20 (80.00%) | WRITE_IN_REACTIVE, solid-yield/no-unyielded-write |
| timer-read | 6 | 6 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| non-core-cache | 48 | 0 | 21 | 27 | 43.75% | 18 (37.50%) | 22 (45.83%) | SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP |
| destructure-props | 17 | 0 | 16 | 1 | 94.12% | 16 (94.12%) | 16 (94.12%) | NATIVE_PROPS |
| inline-component | 50 | 0 | 50 | 0 | 100.00% | 50 (100.00%) | 50 (100.00%) | NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF |
| effect-arity | 5 | 0 | 5 | 0 | 100.00% | 5 (100.00%) | 3 (60.00%) | NATIVE_EFFECT_PHASES, TS2554 |
| remove-use-server | 1 | 1 | 0 | 0 | n/a | 0 (n/a) | 0 (n/a) | equivalent |
| callback-throw | 4 | 3 | 1 | 0 | 100.00% | 0 (0.00%) | 1 (100.00%) | FOREIGN_HANDOFF |
| server-new-class | 1 | 0 | 0 | 1 | 0.00% | 0 (0.00%) | 0 (0.00%) | FOREIGN_HANDOFF |

**Program mutation score: 65.25% = 246 / (246 + 131).** 93 equivalents excluded. Exact line: 61.80% (233). Detected: 75.60% (285).

### Why mutants survive

Each survivor of the gate's rule falls in one category: **detected elsewhere** (an expected code the base lacks, outside the routine), **masked: base refused** (the unmutated program is already refused by the transform, which stops at its first refusal), **masked: base errors** (the base already has errors and the mutant adds none: a check suppressed by an earlier error, such as `FOREIGN_HANDOFF`'s "fix the earlier errors"), **different code** (new diagnostics, none expected), **silent** (no new diagnostic). A silent survivor on a clean base is either an equivalent edit the catalogue does not recognise or a missed check; the survivors list below has each one's diff.

| Operator | Detected elsewhere | Masked: base refused | Masked: base errors | Different code | Silent |
| --- | ---: | ---: | ---: | ---: | ---: |
| delete-catch | 5 | 0 | 0 | 0 | 2 |
| delete-errored | 10 | 4 | 5 | 0 | 1 |
| delete-loading | 14 | 4 | 2 | 0 | 2 |
| setup-read | 0 | 21 | 0 | 0 | 0 |
| delete-provider | 15 | 4 | 2 | 0 | 1 |
| never-provided-context | 0 | 4 | 0 | 0 | 0 |
| remove-await | 0 | 0 | 1 | 0 | 1 |
| memo-write | 0 | 4 | 0 | 0 | 0 |
| non-core-cache | 1 | 8 | 1 | 17 | 0 |
| destructure-props | 0 | 0 | 0 | 1 | 0 |
| server-new-class | 0 | 0 | 1 | 0 | 0 |

### Catalogue and equivalent rules

- **delete-catch:** Remove one catch; retain try body and finally. Correction: EVENT_REJECTS added (2026-10-10): an event handler's unhandled failure is EVENT_REJECTS (sugar-design, unhandled rejections); NATIVE_CALLBACK_FAILURE is the foreign-callback code.
- **swallow-catch:** Remove each direct rethrow in a catch. Equivalent reason: A catch may deliberately handle a failure. Removing a rethrow is permitted handling, not a checker error.
- **delete-errored:** Remove Errored tags, retain children.
- **delete-loading:** Remove Loading tags, retain children.
- **setup-read:** Hoist each signal/memo read from JSX or a memo to its enclosing component setup.
- **delete-provider:** Remove a locally declared context provider, retain children.
- **never-provided-context:** Replace each context argument with a fresh context.
- **throw-string:** Replace each constructed class throw with a string. Equivalent reason: Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.
- **throw-object:** Replace each constructed class throw with an object. Equivalent reason: Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.
- **async-reject:** Insert throw new Error after each await statement in an async JSX event callback. Correction: EVENT_REJECTS added (2026-10-10): every site is an event handler, whose unhandled failure is EVENT_REJECTS; NATIVE_CALLBACK_FAILURE is the foreign-callback code.
- **remove-await:** Replace each await expression with its operand. Correction: TS2739, TS2740 and TS2741 added (2026-10-10): TypeScript's assignability error for missing properties (a Promise where its value was expected) is one of these, not TS2322. TS2339 added (2026-10-10, with the kept-promise fix): reading a property of the un-awaited Promise (`data.title`) is that error.
- **memo-write:** Insert a write to each visible signal setter in each memo callback.
- **timer-read:** Insert a settled signal read in each setup-time timer/listener callback. Equivalent reason: A settled signal read in an ignored timer/listener callback is an allowed event read. Failure diagnostics remain recorded.
- **non-core-cache:** Replace createMemo with an inline hand-rolled last-value cache.
- **destructure-props:** Destructure each directly read property in a component parameter; rewrite its references. Parameter snapshots are currently refused (setup snapshots are valid).
- **inline-component:** Define an inline copy at every JSX use of a local component, and use that copy at the edited site. Other callers and exports remain valid.
- **effect-arity:** Remove all but the compute argument (or the only argument).
- **remove-use-server:** Remove each use server directive. Equivalent reason: Removing a server directive changes transport behavior but remains a valid local function; no checker error is required.
- **callback-throw:** Insert a conditional throw of a RangeError at the start of each callback given to an array method or to a module's own helper function, in a component's JSX hole or memo (F-S46, F-S47: the callback's failure is its host's).
- **server-new-class:** Replace each server-function throw with an instance of a fresh local class.

### Corpus provenance

The reviewer app and all 17 stored variants are verbatim snapshots under `scripts/mutation/corpus/reviewer`. They include all twelve numbered mistakes plus the boundary removals and throw variants. Historical programs come from `scripts/native/fixtures.mjs`: 18 reconstructed programs cover the 27 recoverable slots; T12–T15 and R10–R12 remain unavailable. The original two apps are read directly from their unchanged repository sources. The operator seeds ensure every operator has sites; the sugar-edges seed exercises the native edges added since (context hooks and members, setters in plain types, wrappers with boundaries around context readers, array callbacks, effect cleanups, an anonymous default component).

| Project | Files | Base transform / CLI / lint | Origin |
| --- | ---: | --- | --- |
| sierpinski | 1 | completed / passed / passed | examples/originals/sierpinski/src (verbatim) |
| todos | 5 | completed / diagnostics / diagnostics | examples/originals/todos/src (verbatim) |
| reviewer-myapp | 3 | completed / passed / passed | /private/tmp/sy-review-out/myapp/src (verbatim snapshot) |
| reviewer-m01_setup_read | 3 | completed / diagnostics / diagnostics | /private/tmp/sy-review-out/variants/m01_setup_read.tsx (verbatim snapshot) |
| reviewer-m02_noprovider2 | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m02_noprovider2.tsx (verbatim snapshot) |
| reviewer-m03_throw_string | 3 | refused / diagnostics / blocked-by-transform | /private/tmp/sy-review-out/variants/m03_throw_string.tsx (verbatim snapshot) |
| reviewer-m03b_throw_in_memo | 3 | refused / diagnostics / blocked-by-transform | /private/tmp/sy-review-out/variants/m03b_throw_in_memo.tsx (verbatim snapshot) |
| reviewer-m03c_throw_in_handler | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m03c_throw_in_handler.tsx (verbatim snapshot) |
| reviewer-m04_async_handler | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m04_async_handler.tsx (verbatim snapshot) |
| reviewer-m05_swallow | 3 | completed / passed / passed | /private/tmp/sy-review-out/variants/m05_swallow.tsx (verbatim snapshot) |
| reviewer-m06_memo_writes | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m06_memo_writes.tsx (verbatim snapshot) |
| reviewer-m07_timeout_read | 3 | completed / passed / passed | /private/tmp/sy-review-out/variants/m07_timeout_read.tsx (verbatim snapshot) |
| reviewer-m08_portal | 3 | completed / passed / passed | /private/tmp/sy-review-out/variants/m08_portal.tsx (verbatim snapshot) |
| reviewer-m09_destructure | 3 | refused / diagnostics / blocked-by-transform | /private/tmp/sy-review-out/variants/m09_destructure.tsx (verbatim snapshot) |
| reviewer-m10_conditional | 3 | completed / passed / passed | /private/tmp/sy-review-out/variants/m10_conditional.tsx (verbatim snapshot) |
| reviewer-m11_nested_comp | 3 | completed / passed / diagnostics | /private/tmp/sy-review-out/variants/m11_nested_comp.tsx (verbatim snapshot) |
| reviewer-m12_effect_arity | 3 | refused / diagnostics / blocked-by-transform | /private/tmp/sy-review-out/variants/m12_effect_arity.tsx (verbatim snapshot) |
| reviewer-s2a_noloading | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/s2a_noloading.tsx (verbatim snapshot) |
| reviewer-s2b_noprovider | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/s2b_noprovider.tsx (verbatim snapshot) |
| reviewer-s2c_noerrored | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/s2c_noerrored.tsx (verbatim snapshot) |
| review-slots-tag | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T01, L01 |
| review-slots-setup-read | 1 | completed / diagnostics / diagnostics | scripts/native/fixtures.mjs; reconstructed slots T02, L02, R01, R04 |
| review-slots-named-event | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T03, L04 |
| review-slots-inline-event | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T04, L03, R02 |
| review-slots-effect-arity | 1 | refused / diagnostics / blocked-by-transform | scripts/native/fixtures.mjs; reconstructed slots T05 |
| review-slots-row | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T06, L07 |
| review-slots-pending-root | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots T07 |
| review-slots-colored-prop | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T08 |
| review-slots-throw-error | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots T09, R03 |
| review-slots-context | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T10 |
| review-slots-lazy-child | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T11 |
| review-slots-eager-jsx | 1 | completed / diagnostics / diagnostics | scripts/native/fixtures.mjs; reconstructed slots L05 |
| review-slots-catch | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots L06 |
| review-slots-memo-write | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots R05 |
| review-slots-hole-create | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots R06 |
| review-slots-async-effect | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots R07 |
| review-slots-missing-context | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots R08 |
| review-slots-unhandled-failure | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots R09 |
| operator-seeds | 2 | completed / diagnostics / passed | Additional plain Solid controls for catch, async event and server sites |
| sugar-edges | 4 | completed / passed / passed | Plain Solid exercising the native edges: context hooks and members, setters in plain types, wrappers with boundaries around context readers, array callbacks, effect cleanups, an anonymous default component |
| rendering-edges | 5 | completed / passed / passed | Plain Solid exercising Rendering's native edges: a component factory with a tuple context and destructured members, a derived store, async iterable producers, a Repeat index key, isPending thunks, a lazy page, root trees (CSR, and a server function's with a ParentProps shell) |

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

### F-M1: M0009 delete-loading at sierpinski/main.tsx:36 (detected elsewhere)

Expected in the mutated routine (lines 13–49): PENDING_ROOT.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -33,7 +33,7 @@
   });
 
   return (
-    <Loading fallback={"Loading..."}>
+    <>
       <div
         class="container"
         style={{
@@ -44,7 +44,7 @@
           {seconds()}
         </Triangle>
       </div>
-    </Loading>
+    </>
   );
 };
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/main.tsx:110:25 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/main.tsx:115:8: The app is rendered here. can suspend (pending); never fails; can wait; needs no context
solid-yield check: 1 files, 1 errors
```

### F-M2: M0012 destructure-props at sierpinski/main.tsx:51 (different code)

Expected in the mutated routine (lines 51–87): NATIVE_PROPS.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -48,19 +48,19 @@
   );
 };
 
-const Triangle = (props: TriangleProps) => {
+const Triangle = ({ children: __mutantProp1135, ...props }: TriangleProps) => {
   let { x, y, s } = props;
   if (s <= TARGET) {
     return (
       <Dot x={x - TARGET / 2} y={y - TARGET / 2} s={TARGET}>
-        {props.children}
+        {__mutantProp1135}
       </Dot>
     );
   }
   s = s / 2;
 
   const slowChildren = createMemo(() => {
-    const seconds = props.children;
+    const seconds = __mutantProp1135;
     return new Promise<number>(res => {
       const t = requestIdleCallback(() => {
         const e = performance.now() + 0.8;
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/main.tsx:1:1 error TS95000: [TRANSFORM] Snapshot Dot.x is not a fixed numeric prop; ordered snapshot lowering is required. (<job>/source/main.tsx)
solid-yield check: 1 files, 1 errors
transform main.tsx:1 [NATIVE_RECURSION] [NATIVE_RECURSION] Snapshot Dot.x is not a fixed numeric prop; ordered snapshot lowering is required. (<job>/source/main.tsx)
```

### F-M3: M0014 non-core-cache at sierpinski/main.tsx:62 (detected elsewhere)

Expected in the mutated routine (lines 51–87): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -59,7 +59,7 @@
   }
   s = s / 2;
 
-  const slowChildren = createMemo(() => {
+  const slowChildren = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => {
     const seconds = props.children;
     return new Promise<number>(res => {
       const t = requestIdleCallback(() => {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/main.tsx:110:25 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: unknown.
  related: <job>/source/main.tsx:115:8: The app is rendered here. does not suspend; can fail with an unknown error; does not wait; needs no context
<job>/source/main.tsx:51:7 error TS2322: [generated] [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
  related: <job>/source/main.tsx:51:7: [generated] [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
<job>/source/main.tsx:62:96 error TS2345: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
<job>/source/main.tsx:51:7 error TS2769: [generated] [LAZY_VIEW] fallback is a lazy view: function* () { return <.../>; }
<job>/source/main.tsx:51:7 error TS2589: [generated] Type instantiation is excessively deep and possibly infinite.
<job>/source/main.tsx:51:7 error TS2322: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 1 files, 6 errors
```

### F-M4: M0035 delete-errored at todos/app.tsx:133 (detected elsewhere)

Expected in the mutated routine (lines 130–152): FOREIGN_HANDOFF.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -130,14 +130,14 @@
 export function App() {
   const filter = createHashFilter();
   return (
-    <Errored
-      fallback={(err, reset) => (
-        <div class="app-error">
-          <p>Something went wrong: {String(err())}</p>
-          <button onClick={reset}>Reset</button>
-        </div>
-      )}
-    >
+    <>
+
+
+
+
+
+
+
       <TodosContext value={createTodos()}>
         <section class="todoapp">
           <Header />
@@ -147,6 +147,6 @@
           </Loading>
         </section>
       </TodosContext>
-    </Errored>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:75:17 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: SyntaxError.
  related: <job>/source/main.tsx:4:15: The app is rendered here. does not suspend; can fail with SyntaxError; can wait; needs no context
solid-yield check: 5 files, 3 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M5: M0036 delete-provider at todos/app.tsx:141 (detected elsewhere)

Expected in the mutated routine (lines 130–152): NO_PROVIDER.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -138,7 +138,7 @@
         </div>
       )}
     >
-      <TodosContext value={createTodos()}>
+      <>
         <section class="todoapp">
           <Header />
           <Loading fallback={<p class="loading">Loading…</p>}>
@@ -146,7 +146,7 @@
             <Footer filter={filter()} />
           </Loading>
         </section>
-      </TodosContext>
+      </>
     </Errored>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:8:38 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: TodosContext.
  related: <job>/source/main.tsx:4:15: The app is rendered here. does not suspend; never fails; can wait; needs TodosContext
solid-yield check: 5 files, 3 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M6: M0037 delete-loading at todos/app.tsx:144 (detected elsewhere)

Expected in the mutated routine (lines 130–152): PENDING_ROOT.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -141,10 +141,10 @@
       <TodosContext value={createTodos()}>
         <section class="todoapp">
           <Header />
-          <Loading fallback={<p class="loading">Loading…</p>}>
+          <>
             <MainSection filter={filter()} />
             <Footer filter={filter()} />
-          </Loading>
+          </>
         </section>
       </TodosContext>
     </Errored>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:75:17 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/main.tsx:4:15: The app is rendered here. can suspend (pending); never fails; can wait; needs no context
solid-yield check: 5 files, 3 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M7: M0039 delete-catch at todos/todos.ts:99 (detected elsewhere)

Expected in the mutated routine (lines 85–176): FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS.

```diff
--- todos/todos.ts
+++ todos/todos.ts (mutant)
@@ -96,12 +96,12 @@
         if (old) old.pending = true;
         else t.push({ ...todo, pending: true });
       });
-      try {
+      {
         yield api.addTodo(todo);
         delete Errors[todo.id];
-      } catch {
-        Errors[todo.id] ||= { type: "addTodo", args: [todo] };
       }
+
+
       refresh(todos);
     }),
     removeTodo: action(function* (id: string) {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:55:24 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:16:20 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 5 files, 4 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M8: M0040 delete-catch at todos/todos.ts:109 (detected elsewhere)

Expected in the mutated routine (lines 85–176): FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS.

```diff
--- todos/todos.ts
+++ todos/todos.ts (mutant)
@@ -106,12 +106,12 @@
     }),
     removeTodo: action(function* (id: string) {
       setTodos(t => t.filter(todo => todo.id !== id));
-      try {
+      {
         yield api.removeTodo(id);
         delete Errors[id];
-      } catch {
-        Errors[id] ||= { type: "removeTodo", args: [id] };
       }
+
+
       refresh(todos);
     }),
     toggleTodo: action(function* (id: string, completed: boolean) {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:59:42 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:55:24 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 5 files, 4 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M9: M0041 delete-catch at todos/todos.ts:125 (detected elsewhere)

Expected in the mutated routine (lines 85–176): FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS.

```diff
--- todos/todos.ts
+++ todos/todos.ts (mutant)
@@ -122,12 +122,12 @@
           todo.pending = true;
         }
       });
-      try {
+      {
         yield api.toggleTodo(id, completed);
         delete Errors[id];
-      } catch {
-        Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
       }
+
+
       refresh(todos);
     }),
     toggleAll: action(function* (completed: boolean) {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:55:24 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:47:20 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 5 files, 4 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M10: M0042 delete-catch at todos/todos.ts:144 (detected elsewhere)

Expected in the mutated routine (lines 85–176): FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS.

```diff
--- todos/todos.ts
+++ todos/todos.ts (mutant)
@@ -141,16 +141,16 @@
           }
         });
       });
-      try {
+      {
         yield api.toggleAll(ids, completed);
         ids.forEach(id => delete Errors[id]);
-      } catch {
-        // Bulk failed — fan the error out to per-item entries so each
-        // failed item gets its own retry affordance via `retryTodo`.
-        ids.forEach(id => {
-          Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
-        });
       }
+
+
+
+
+
+
       refresh(todos);
     }),
     clearCompleted: action(function* () {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 5 files, 2 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M11: M0043 delete-catch at todos/todos.ts:159 (detected elsewhere)

Expected in the mutated routine (lines 85–176): FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS.

```diff
--- todos/todos.ts
+++ todos/todos.ts (mutant)
@@ -156,14 +156,14 @@
     clearCompleted: action(function* () {
       const ids = todos.filter(t => t.completed).map(t => t.id);
       setTodos(t => t.filter(todo => !todo.completed));
-      try {
+      {
         yield api.clearCompleted(ids);
         ids.forEach(id => delete Errors[id]);
-      } catch {
-        ids.forEach(id => {
-          Errors[id] ||= { type: "removeTodo", args: [id] };
-        });
       }
+
+
+
+
       refresh(todos);
     }),
     retryTodo(todo: Todo): Promise<void> {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:121:52 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError | TypeError | unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/app.tsx:82:21 error TS95000: [EVENT_REJECTS] This handler can fail with SyntaxError and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 5 files, 2 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M12: M0053 non-core-cache at reviewer-myapp/App.tsx:14 (different code)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-myapp/App.tsx
+++ reviewer-myapp/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
```

### F-M13: M0055 delete-provider at reviewer-myapp/App.tsx:24 (detected elsewhere)

Expected in the mutated routine (lines 22–33): NO_PROVIDER.

```diff
--- reviewer-myapp/App.tsx
+++ reviewer-myapp/App.tsx (mutant)
@@ -21,13 +21,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:13:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 1 errors
```

### F-M14: M0056 delete-errored at reviewer-myapp/App.tsx:26 (detected elsewhere)

Expected in the mutated routine (lines 22–33): FOREIGN_HANDOFF.

```diff
--- reviewer-myapp/App.tsx
+++ reviewer-myapp/App.tsx (mutant)
@@ -23,11 +23,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 1 errors
```

### F-M15: M0057 delete-loading at reviewer-myapp/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 22–33): PENDING_ROOT.

```diff
--- reviewer-myapp/App.tsx
+++ reviewer-myapp/App.tsx (mutant)
@@ -24,9 +24,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs no context
solid-yield check: 3 files, 1 errors
```

### F-M16: M0070 non-core-cache at reviewer-m01_setup_read/App.tsx:16 (different code)

Expected in the mutated routine (lines 14–22): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -13,7 +13,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:19:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] Move this read into JSX, a memo, an effect, or an event so it stays reactive.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 3 errors
lint App.tsx:8 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M17: M0072 delete-provider at reviewer-m01_setup_read/App.tsx:26 (masked: base errors)

Expected in the mutated routine (lines 24–35): NO_PROVIDER.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -23,13 +23,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] Move this read into JSX, a memo, an effect, or an event so it stays reactive.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 2 errors
lint App.tsx:8 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M18: M0073 delete-errored at reviewer-m01_setup_read/App.tsx:28 (masked: base errors)

Expected in the mutated routine (lines 24–35): FOREIGN_HANDOFF.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -25,11 +25,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] Move this read into JSX, a memo, an effect, or an event so it stays reactive.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 2 errors
lint App.tsx:8 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M19: M0074 delete-loading at reviewer-m01_setup_read/App.tsx:29 (masked: base errors)

Expected in the mutated routine (lines 24–35): PENDING_ROOT.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -26,9 +26,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] Move this read into JSX, a memo, an effect, or an event so it stays reactive.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 2 errors
lint App.tsx:8 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M20: M0088 non-core-cache at reviewer-m02_noprovider2/App.tsx:16 (different code)

Expected in the mutated routine (lines 13–22): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -13,7 +13,7 @@
 function List() {
   const theme = useContext(ThemeCtx);
   const user = useContext(UserCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme + user}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:15:16 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: UserCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs UserCtx
<job>/source/App.tsx:19:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 2 errors
```

### F-M21: M0090 delete-provider at reviewer-m02_noprovider2/App.tsx:26 (detected elsewhere)

Expected in the mutated routine (lines 24–35): NO_PROVIDER.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -23,13 +23,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:14:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx | UserCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx | UserCtx
solid-yield check: 3 files, 1 errors
```

### F-M22: M0091 delete-errored at reviewer-m02_noprovider2/App.tsx:28 (detected elsewhere)

Expected in the mutated routine (lines 24–35): FOREIGN_HANDOFF.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -25,11 +25,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:19:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs UserCtx
<job>/source/App.tsx:15:16 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: UserCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs UserCtx
solid-yield check: 3 files, 2 errors
```

### F-M23: M0092 delete-loading at reviewer-m02_noprovider2/App.tsx:29 (detected elsewhere)

Expected in the mutated routine (lines 24–35): PENDING_ROOT.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -26,9 +26,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:15:16 error TS2345: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: UserCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs UserCtx
<job>/source/App.tsx:19:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs UserCtx
solid-yield check: 3 files, 2 errors
```

### F-M24: M0097 non-core-cache at reviewer-m03_throw_string/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–11): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   if (count() > 100) throw 'too big';
-  const twice = createMemo(() => count() * 2);
+  const twice = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => count() * 2);
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M25: M0098 memo-write at reviewer-m03_throw_string/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–11): WRITE_IN_REACTIVE, solid-yield/no-unyielded-write.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   if (count() > 100) throw 'too big';
-  const twice = createMemo(() => count() * 2);
+  const twice = createMemo(()=>{setCount(0);return count()*2;});
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M26: M0099 setup-read at reviewer-m03_throw_string/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -6,8 +6,8 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   if (count() > 100) throw 'too big';
-  const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const twice = createMemo(() => __mutantSnapshot320 * 2);
+  const __mutantSnapshot320 = count(); return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M27: M0100 setup-read at reviewer-m03_throw_string/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -7,7 +7,7 @@
   const [count, setCount] = createSignal(0);
   if (count() > 100) throw 'too big';
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot375 = count(); return <button onClick={() => setCount(__mutantSnapshot375 + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M28: M0101 setup-read at reviewer-m03_throw_string/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -7,7 +7,7 @@
   const [count, setCount] = createSignal(0);
   if (count() > 100) throw 'too big';
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot390 = count(); return <button onClick={() => setCount(count() + 1)}>{__mutantSnapshot390} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M29: M0102 setup-read at reviewer-m03_throw_string/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -7,7 +7,7 @@
   const [count, setCount] = createSignal(0);
   if (count() > 100) throw 'too big';
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot402 = twice(); return <button onClick={() => setCount(count() + 1)}>{count()} / {__mutantSnapshot402}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M30: M0104 never-provided-context at reviewer-m03_throw_string/App.tsx:14 (masked: base refused)

Expected in the mutated routine (lines 13–21): NO_PROVIDER.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -11,7 +11,7 @@
 }
 
 function List() {
-  const theme = useContext(ThemeCtx);
+  const theme = useContext(createContext<number>());
   const items = createMemo(() => fetchItems());
   return (
     <ul class={theme}>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M31: M0105 non-core-cache at reviewer-m03_throw_string/App.tsx:15 (masked: base refused)

Expected in the mutated routine (lines 13–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M32: M0106 setup-read at reviewer-m03_throw_string/App.tsx:16 (masked: base refused)

Expected in the mutated routine (lines 13–21): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -13,9 +13,9 @@
 function List() {
   const theme = useContext(ThemeCtx);
   const items = createMemo(() => fetchItems());
-  return (
+  const __mutantSnapshot579 = items(); return (
     <ul class={theme}>
-      <For each={items()}>{item => <li>{item.name}</li>}</For>
+      <For each={__mutantSnapshot579}>{item => <li>{item.name}</li>}</For>
     </ul>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M33: M0107 delete-provider at reviewer-m03_throw_string/App.tsx:25 (masked: base refused)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M34: M0108 delete-errored at reviewer-m03_throw_string/App.tsx:27 (masked: base refused)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M35: M0109 delete-loading at reviewer-m03_throw_string/App.tsx:28 (masked: base refused)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:22 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M36: M0114 non-core-cache at reviewer-m03b_throw_in_memo/App.tsx:8 (masked: base refused)

Expected in the mutated routine (lines 6–10): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -5,7 +5,7 @@
 
 function Counter() {
   const [count, setCount] = createSignal(0);
-  const twice = createMemo(() => { if (count() > 100) throw 'too big'; return count() * 2; });
+  const twice = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => { if (count() > 100) throw 'too big'; return count() * 2; });
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:116 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M37: M0115 memo-write at reviewer-m03b_throw_in_memo/App.tsx:8 (masked: base refused)

Expected in the mutated routine (lines 6–10): WRITE_IN_REACTIVE, solid-yield/no-unyielded-write.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -5,7 +5,7 @@
 
 function Counter() {
   const [count, setCount] = createSignal(0);
-  const twice = createMemo(() => { if (count() > 100) throw 'too big'; return count() * 2; });
+  const twice = createMemo(() => { setCount(0); if (count() > 100) throw 'too big'; return count() * 2; });
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:68 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M38: M0116 setup-read at reviewer-m03b_throw_in_memo/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -5,8 +5,8 @@
 
 function Counter() {
   const [count, setCount] = createSignal(0);
-  const twice = createMemo(() => { if (count() > 100) throw 'too big'; return count() * 2; });
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const twice = createMemo(() => { if (__mutantSnapshot288 > 100) throw 'too big'; return count() * 2; });
+  const __mutantSnapshot288 = count(); return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:67 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M39: M0117 setup-read at reviewer-m03b_throw_in_memo/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -5,8 +5,8 @@
 
 function Counter() {
   const [count, setCount] = createSignal(0);
-  const twice = createMemo(() => { if (count() > 100) throw 'too big'; return count() * 2; });
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const twice = createMemo(() => { if (count() > 100) throw 'too big'; return __mutantSnapshot327 * 2; });
+  const __mutantSnapshot327 = count(); return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M40: M0118 setup-read at reviewer-m03b_throw_in_memo/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => { if (count() > 100) throw 'too big'; return count() * 2; });
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot385 = count(); return <button onClick={() => setCount(__mutantSnapshot385 + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M41: M0119 setup-read at reviewer-m03b_throw_in_memo/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => { if (count() > 100) throw 'too big'; return count() * 2; });
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot400 = count(); return <button onClick={() => setCount(count() + 1)}>{__mutantSnapshot400} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M42: M0120 setup-read at reviewer-m03b_throw_in_memo/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => { if (count() > 100) throw 'too big'; return count() * 2; });
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot412 = twice(); return <button onClick={() => setCount(count() + 1)}>{count()} / {__mutantSnapshot412}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M43: M0122 never-provided-context at reviewer-m03b_throw_in_memo/App.tsx:13 (masked: base refused)

Expected in the mutated routine (lines 12–20): NO_PROVIDER.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -10,7 +10,7 @@
 }
 
 function List() {
-  const theme = useContext(ThemeCtx);
+  const theme = useContext(createContext<number>());
   const items = createMemo(() => fetchItems());
   return (
     <ul class={theme}>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M44: M0123 non-core-cache at reviewer-m03b_throw_in_memo/App.tsx:14 (masked: base refused)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M45: M0124 setup-read at reviewer-m03b_throw_in_memo/App.tsx:15 (masked: base refused)

Expected in the mutated routine (lines 12–20): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -12,9 +12,9 @@
 function List() {
   const theme = useContext(ThemeCtx);
   const items = createMemo(() => fetchItems());
-  return (
+  const __mutantSnapshot589 = items(); return (
     <ul class={theme}>
-      <For each={items()}>{item => <li>{item.name}</li>}</For>
+      <For each={__mutantSnapshot589}>{item => <li>{item.name}</li>}</For>
     </ul>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M46: M0125 delete-provider at reviewer-m03b_throw_in_memo/App.tsx:24 (masked: base refused)

Expected in the mutated routine (lines 22–33): NO_PROVIDER.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -21,13 +21,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M47: M0126 delete-errored at reviewer-m03b_throw_in_memo/App.tsx:26 (masked: base refused)

Expected in the mutated routine (lines 22–33): FOREIGN_HANDOFF.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -23,11 +23,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M48: M0127 delete-loading at reviewer-m03b_throw_in_memo/App.tsx:27 (masked: base refused)

Expected in the mutated routine (lines 22–33): PENDING_ROOT.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -24,9 +24,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:55 error TS95000: [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_THROW] Throw an Error object so callers can identify and handle this failure.
```

### F-M49: M0143 non-core-cache at reviewer-m03c_throw_in_handler/App.tsx:14 (different code)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m03c_throw_in_handler/App.tsx
+++ reviewer-m03c_throw_in_handler/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:9:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 2 errors
```

### F-M50: M0145 delete-provider at reviewer-m03c_throw_in_handler/App.tsx:24 (detected elsewhere)

Expected in the mutated routine (lines 22–33): NO_PROVIDER.

```diff
--- reviewer-m03c_throw_in_handler/App.tsx
+++ reviewer-m03c_throw_in_handler/App.tsx (mutant)
@@ -21,13 +21,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:9:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
<job>/source/App.tsx:13:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs ThemeCtx
solid-yield check: 3 files, 2 errors
```

### F-M51: M0146 delete-errored at reviewer-m03c_throw_in_handler/App.tsx:26 (masked: base errors)

Expected in the mutated routine (lines 22–33): FOREIGN_HANDOFF.

```diff
--- reviewer-m03c_throw_in_handler/App.tsx
+++ reviewer-m03c_throw_in_handler/App.tsx (mutant)
@@ -23,11 +23,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:9:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
solid-yield check: 3 files, 1 errors
```

### F-M52: M0147 delete-loading at reviewer-m03c_throw_in_handler/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 22–33): PENDING_ROOT.

```diff
--- reviewer-m03c_throw_in_handler/App.tsx
+++ reviewer-m03c_throw_in_handler/App.tsx (mutant)
@@ -24,9 +24,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:9:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
<job>/source/App.tsx:17:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 2 errors
```

### F-M53: M0163 non-core-cache at reviewer-m04_async_handler/App.tsx:15 (different code)

Expected in the mutated routine (lines 13–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:10:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 2 errors
```

### F-M54: M0165 delete-provider at reviewer-m04_async_handler/App.tsx:25 (detected elsewhere)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:10:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
<job>/source/App.tsx:14:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs ThemeCtx
solid-yield check: 3 files, 2 errors
```

### F-M55: M0166 delete-errored at reviewer-m04_async_handler/App.tsx:27 (masked: base errors)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:10:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
solid-yield check: 3 files, 1 errors
```

### F-M56: M0167 delete-loading at reviewer-m04_async_handler/App.tsx:28 (detected elsewhere)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:10:27 error TS95000: [EVENT_REJECTS] This handler can fail with Error and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/index.tsx:3:15: The app is rendered here.
<job>/source/App.tsx:18:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 2 errors
```

### F-M57: M0180 non-core-cache at reviewer-m05_swallow/App.tsx:14 (different code)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(async () => { try { return await fetchItems(); } catch { return []; } });
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(async () => { try { return await fetchItems(); } catch { return []; } });
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
```

### F-M58: M0181 delete-catch at reviewer-m05_swallow/App.tsx:14 (silent)

Expected in the mutated routine (lines 12–20): FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(async () => { try { return await fetchItems(); } catch { return []; } });
+  const items = createMemo(async () => { { return await fetchItems(); } });
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 3 files, 0 errors
```

### F-M59: M0182 remove-await at reviewer-m05_swallow/App.tsx:14 (silent)

Expected in the mutated routine (lines 12–20): TS2322, TS2345, TS2739, TS2740, TS2741, TS2339, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(async () => { try { return await fetchItems(); } catch { return []; } });
+  const items = createMemo(async () => { try { return fetchItems(); } catch { return []; } });
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 3 files, 0 errors
```

### F-M60: M0184 delete-provider at reviewer-m05_swallow/App.tsx:24 (detected elsewhere)

Expected in the mutated routine (lines 22–33): NO_PROVIDER.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -21,13 +21,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:13:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 1 errors
```

### F-M61: M0185 delete-errored at reviewer-m05_swallow/App.tsx:26 (silent)

Expected in the mutated routine (lines 22–33): FOREIGN_HANDOFF.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -23,11 +23,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 3 files, 0 errors
```

### F-M62: M0186 delete-loading at reviewer-m05_swallow/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 22–33): PENDING_ROOT.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -24,9 +24,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs no context
solid-yield check: 3 files, 1 errors
```

### F-M63: M0200 non-core-cache at reviewer-m06_memo_writes/App.tsx:14 (different code)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m06_memo_writes/App.tsx
+++ reviewer-m06_memo_writes/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] Move this write into an event or effect; a memo or JSX read cannot write state.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 3 errors
```

### F-M64: M0202 delete-provider at reviewer-m06_memo_writes/App.tsx:24 (masked: base errors)

Expected in the mutated routine (lines 22–33): NO_PROVIDER.

```diff
--- reviewer-m06_memo_writes/App.tsx
+++ reviewer-m06_memo_writes/App.tsx (mutant)
@@ -21,13 +21,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] Move this write into an event or effect; a memo or JSX read cannot write state.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 2 errors
```

### F-M65: M0203 delete-errored at reviewer-m06_memo_writes/App.tsx:26 (masked: base errors)

Expected in the mutated routine (lines 22–33): FOREIGN_HANDOFF.

```diff
--- reviewer-m06_memo_writes/App.tsx
+++ reviewer-m06_memo_writes/App.tsx (mutant)
@@ -23,11 +23,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] Move this write into an event or effect; a memo or JSX read cannot write state.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 2 errors
```

### F-M66: M0204 delete-loading at reviewer-m06_memo_writes/App.tsx:27 (masked: base errors)

Expected in the mutated routine (lines 22–33): PENDING_ROOT.

```diff
--- reviewer-m06_memo_writes/App.tsx
+++ reviewer-m06_memo_writes/App.tsx (mutant)
@@ -24,9 +24,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] Move this write into an event or effect; a memo or JSX read cannot write state.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Fix the earlier errors in this component before checking its render call. Remaining: any.
solid-yield check: 3 files, 2 errors
```

### F-M67: M0218 non-core-cache at reviewer-m07_timeout_read/App.tsx:15 (different code)

Expected in the mutated routine (lines 13–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m07_timeout_read/App.tsx
+++ reviewer-m07_timeout_read/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
```

### F-M68: M0220 delete-provider at reviewer-m07_timeout_read/App.tsx:25 (detected elsewhere)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m07_timeout_read/App.tsx
+++ reviewer-m07_timeout_read/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:14:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 1 errors
```

### F-M69: M0221 delete-errored at reviewer-m07_timeout_read/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m07_timeout_read/App.tsx
+++ reviewer-m07_timeout_read/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:18:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 1 errors
```

### F-M70: M0222 delete-loading at reviewer-m07_timeout_read/App.tsx:28 (detected elsewhere)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m07_timeout_read/App.tsx
+++ reviewer-m07_timeout_read/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:18:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs no context
solid-yield check: 3 files, 1 errors
```

### F-M71: M0235 non-core-cache at reviewer-m08_portal/App.tsx:15 (different code)

Expected in the mutated routine (lines 13–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m08_portal/App.tsx
+++ reviewer-m08_portal/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
```

### F-M72: M0237 delete-provider at reviewer-m08_portal/App.tsx:25 (detected elsewhere)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m08_portal/App.tsx
+++ reviewer-m08_portal/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Portal><Counter /></Portal>
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
<job>/source/App.tsx:14:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
```

### F-M73: M0238 delete-errored at reviewer-m08_portal/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m08_portal/App.tsx
+++ reviewer-m08_portal/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Portal><Counter /></Portal>
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
<job>/source/App.tsx:18:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
```

### F-M74: M0239 delete-loading at reviewer-m08_portal/App.tsx:28 (detected elsewhere)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m08_portal/App.tsx
+++ reviewer-m08_portal/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Portal><Counter /></Portal>
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
<job>/source/App.tsx:18:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs no context
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Handle failures inside Portal or its callbacks; this imported component (Portal from @solidjs/web) is outside the native check.
```

### F-M75: M0244 non-core-cache at reviewer-m09_destructure/App.tsx:8 (masked: base refused)

Expected in the mutated routine (lines 6–10): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -5,7 +5,7 @@
 
 function Counter() {
   const [count, setCount] = createSignal(0);
-  const twice = createMemo(() => count() * 2);
+  const twice = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => count() * 2);
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M76: M0245 memo-write at reviewer-m09_destructure/App.tsx:8 (masked: base refused)

Expected in the mutated routine (lines 6–10): WRITE_IN_REACTIVE, solid-yield/no-unyielded-write.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -5,7 +5,7 @@
 
 function Counter() {
   const [count, setCount] = createSignal(0);
-  const twice = createMemo(() => count() * 2);
+  const twice = createMemo(()=>{setCount(0);return count()*2;});
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M77: M0246 setup-read at reviewer-m09_destructure/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -5,8 +5,8 @@
 
 function Counter() {
   const [count, setCount] = createSignal(0);
-  const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const twice = createMemo(() => __mutantSnapshot282 * 2);
+  const __mutantSnapshot282 = count(); return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
 
 function List({ title }: { title: string }) {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M78: M0247 setup-read at reviewer-m09_destructure/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot337 = count(); return <button onClick={() => setCount(__mutantSnapshot337 + 1)}>{count()} / {twice()}</button>;
 }
 
 function List({ title }: { title: string }) {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M79: M0248 setup-read at reviewer-m09_destructure/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot352 = count(); return <button onClick={() => setCount(count() + 1)}>{__mutantSnapshot352} / {twice()}</button>;
 }
 
 function List({ title }: { title: string }) {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M80: M0249 setup-read at reviewer-m09_destructure/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–10): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot364 = twice(); return <button onClick={() => setCount(count() + 1)}>{count()} / {__mutantSnapshot364}</button>;
 }
 
 function List({ title }: { title: string }) {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M81: M0251 never-provided-context at reviewer-m09_destructure/App.tsx:14 (masked: base refused)

Expected in the mutated routine (lines 12–21): NO_PROVIDER.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List({ title }: { title: string }) {
   console.log(title);
-  const theme = useContext(ThemeCtx);
+  const theme = useContext(createContext<number>());
   const items = createMemo(() => fetchItems());
   return (
     <ul class={theme}>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M82: M0252 non-core-cache at reviewer-m09_destructure/App.tsx:15 (masked: base refused)

Expected in the mutated routine (lines 12–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -12,7 +12,7 @@
 function List({ title }: { title: string }) {
   console.log(title);
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M83: M0253 setup-read at reviewer-m09_destructure/App.tsx:16 (masked: base refused)

Expected in the mutated routine (lines 12–21): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -13,9 +13,9 @@
   console.log(title);
   const theme = useContext(ThemeCtx);
   const items = createMemo(() => fetchItems());
-  return (
+  const __mutantSnapshot591 = items(); return (
     <ul class={theme}>
-      <For each={items()}>{item => <li>{item.name}</li>}</For>
+      <For each={__mutantSnapshot591}>{item => <li>{item.name}</li>}</For>
     </ul>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M84: M0254 delete-provider at reviewer-m09_destructure/App.tsx:25 (masked: base refused)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List title="x" />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M85: M0255 delete-errored at reviewer-m09_destructure/App.tsx:27 (masked: base refused)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List title="x" />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M86: M0256 delete-loading at reviewer-m09_destructure/App.tsx:28 (masked: base refused)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List title="x" />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Use a props parameter and read props.name where needed; destructuring loses reactive updates.
```

### F-M87: M0269 non-core-cache at reviewer-m10_conditional/App.tsx:15 (different code)

Expected in the mutated routine (lines 13–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m10_conditional/App.tsx
+++ reviewer-m10_conditional/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
```

### F-M88: M0271 delete-provider at reviewer-m10_conditional/App.tsx:25 (detected elsewhere)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m10_conditional/App.tsx
+++ reviewer-m10_conditional/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:14:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 1 errors
```

### F-M89: M0272 delete-errored at reviewer-m10_conditional/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m10_conditional/App.tsx
+++ reviewer-m10_conditional/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:18:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 1 errors
```

### F-M90: M0273 delete-loading at reviewer-m10_conditional/App.tsx:28 (detected elsewhere)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m10_conditional/App.tsx
+++ reviewer-m10_conditional/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:18:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs no context
solid-yield check: 3 files, 1 errors
```

### F-M91: M0287 non-core-cache at reviewer-m11_nested_comp/App.tsx:15 (different code)

Expected in the mutated routine (lines 13–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m11_nested_comp/App.tsx
+++ reviewer-m11_nested_comp/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M92: M0289 delete-provider at reviewer-m11_nested_comp/App.tsx:25 (detected elsewhere)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m11_nested_comp/App.tsx
+++ reviewer-m11_nested_comp/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:14:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M93: M0290 delete-errored at reviewer-m11_nested_comp/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m11_nested_comp/App.tsx
+++ reviewer-m11_nested_comp/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:18:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M94: M0291 delete-loading at reviewer-m11_nested_comp/App.tsx:28 (detected elsewhere)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m11_nested_comp/App.tsx
+++ reviewer-m11_nested_comp/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:18:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs no context
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M95: M0297 non-core-cache at reviewer-m12_effect_arity/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–11): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   createEffect(() => { console.log(count()); });
-  const twice = createMemo(() => count() * 2);
+  const twice = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => count() * 2);
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M96: M0298 memo-write at reviewer-m12_effect_arity/App.tsx:9 (masked: base refused)

Expected in the mutated routine (lines 6–11): WRITE_IN_REACTIVE, solid-yield/no-unyielded-write.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   createEffect(() => { console.log(count()); });
-  const twice = createMemo(() => count() * 2);
+  const twice = createMemo(()=>{setCount(0);return count()*2;});
   return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M97: M0299 setup-read at reviewer-m12_effect_arity/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -6,8 +6,8 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   createEffect(() => { console.log(count()); });
-  const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const twice = createMemo(() => __mutantSnapshot345 * 2);
+  const __mutantSnapshot345 = count(); return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M98: M0300 setup-read at reviewer-m12_effect_arity/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -7,7 +7,7 @@
   const [count, setCount] = createSignal(0);
   createEffect(() => { console.log(count()); });
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot400 = count(); return <button onClick={() => setCount(__mutantSnapshot400 + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M99: M0301 setup-read at reviewer-m12_effect_arity/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -7,7 +7,7 @@
   const [count, setCount] = createSignal(0);
   createEffect(() => { console.log(count()); });
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot415 = count(); return <button onClick={() => setCount(count() + 1)}>{__mutantSnapshot415} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M100: M0302 setup-read at reviewer-m12_effect_arity/App.tsx:10 (masked: base refused)

Expected in the mutated routine (lines 6–11): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -7,7 +7,7 @@
   const [count, setCount] = createSignal(0);
   createEffect(() => { console.log(count()); });
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot427 = twice(); return <button onClick={() => setCount(count() + 1)}>{count()} / {__mutantSnapshot427}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M101: M0304 never-provided-context at reviewer-m12_effect_arity/App.tsx:14 (masked: base refused)

Expected in the mutated routine (lines 13–21): NO_PROVIDER.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -11,7 +11,7 @@
 }
 
 function List() {
-  const theme = useContext(ThemeCtx);
+  const theme = useContext(createContext<number>());
   const items = createMemo(() => fetchItems());
   return (
     <ul class={theme}>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M102: M0305 non-core-cache at reviewer-m12_effect_arity/App.tsx:15 (masked: base refused)

Expected in the mutated routine (lines 13–21): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M103: M0306 setup-read at reviewer-m12_effect_arity/App.tsx:16 (masked: base refused)

Expected in the mutated routine (lines 13–21): READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -13,9 +13,9 @@
 function List() {
   const theme = useContext(ThemeCtx);
   const items = createMemo(() => fetchItems());
-  return (
+  const __mutantSnapshot604 = items(); return (
     <ul class={theme}>
-      <For each={items()}>{item => <li>{item.name}</li>}</For>
+      <For each={__mutantSnapshot604}>{item => <li>{item.name}</li>}</For>
     </ul>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M104: M0307 delete-provider at reviewer-m12_effect_arity/App.tsx:25 (masked: base refused)

Expected in the mutated routine (lines 23–34): NO_PROVIDER.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -22,13 +22,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M105: M0308 delete-errored at reviewer-m12_effect_arity/App.tsx:27 (masked: base refused)

Expected in the mutated routine (lines 23–34): FOREIGN_HANDOFF.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -24,11 +24,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M106: M0309 delete-loading at reviewer-m12_effect_arity/App.tsx:28 (masked: base refused)

Expected in the mutated routine (lines 23–34): PENDING_ROOT.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -25,9 +25,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] Pass a tracked compute function and an untracked effect function to createEffect.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M107: M0322 non-core-cache at reviewer-s2a_noloading/App.tsx:14 (different code)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-s2a_noloading/App.tsx
+++ reviewer-s2a_noloading/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
```

### F-M108: M0324 delete-provider at reviewer-s2a_noloading/App.tsx:24 (detected elsewhere)

Expected in the mutated routine (lines 22–33): NO_PROVIDER.

```diff
--- reviewer-s2a_noloading/App.tsx
+++ reviewer-s2a_noloading/App.tsx (mutant)
@@ -21,13 +21,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <>
           <List />
         </>
       </Errored>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:13:17 error TS2345: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs ThemeCtx
<job>/source/App.tsx:17:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 2 errors
```

### F-M109: M0325 delete-errored at reviewer-s2a_noloading/App.tsx:26 (detected elsewhere)

Expected in the mutated routine (lines 22–33): FOREIGN_HANDOFF.

```diff
--- reviewer-s2a_noloading/App.tsx
+++ reviewer-s2a_noloading/App.tsx (mutant)
@@ -23,11 +23,11 @@
   return (
     <ThemeCtx value="dark">
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <>
           <List />
         </>
-      </Errored>
+      </>
     </ThemeCtx>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); can fail with Error; does not wait; needs no context
<job>/source/App.tsx:17:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 2 errors
```

### F-M110: M0338 non-core-cache at reviewer-s2b_noprovider/App.tsx:14 (different code)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-s2b_noprovider/App.tsx
+++ reviewer-s2b_noprovider/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:13:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; never fails; does not wait; needs ThemeCtx
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 2 errors
```

### F-M111: M0340 delete-errored at reviewer-s2b_noprovider/App.tsx:26 (detected elsewhere)

Expected in the mutated routine (lines 22–33): FOREIGN_HANDOFF.

```diff
--- reviewer-s2b_noprovider/App.tsx
+++ reviewer-s2b_noprovider/App.tsx (mutant)
@@ -23,11 +23,11 @@
   return (
     <>
       <Counter />
-      <Errored fallback={err => <p>failed: {String(err)}</p>}>
+      <>
         <Loading fallback="loading…">
           <List />
         </Loading>
-      </Errored>
+      </>
     </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs ThemeCtx
<job>/source/App.tsx:13:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs ThemeCtx
solid-yield check: 3 files, 2 errors
```

### F-M112: M0341 delete-loading at reviewer-s2b_noprovider/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 22–33): PENDING_ROOT.

```diff
--- reviewer-s2b_noprovider/App.tsx
+++ reviewer-s2b_noprovider/App.tsx (mutant)
@@ -24,9 +24,9 @@
     <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </Errored>
     </>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:13:17 error TS2345: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs ThemeCtx
<job>/source/App.tsx:17:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs ThemeCtx
solid-yield check: 3 files, 2 errors
```

### F-M113: M0354 non-core-cache at reviewer-s2c_noerrored/App.tsx:14 (different code)

Expected in the mutated routine (lines 12–20): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- reviewer-s2c_noerrored/App.tsx
+++ reviewer-s2c_noerrored/App.tsx (mutant)
@@ -11,7 +11,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const items = createMemo(() => fetchItems());
+  const items = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => fetchItems());
   return (
     <ul class={theme}>
       <For each={items()}>{item => <li>{item.name}</li>}</For>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
```

### F-M114: M0356 delete-provider at reviewer-s2c_noerrored/App.tsx:24 (detected elsewhere)

Expected in the mutated routine (lines 22–33): NO_PROVIDER.

```diff
--- reviewer-s2c_noerrored/App.tsx
+++ reviewer-s2c_noerrored/App.tsx (mutant)
@@ -21,13 +21,13 @@
 
 export function App() {
   return (
-    <ThemeCtx value="dark">
+    <>
       <Counter />
       <>
         <Loading fallback="loading…">
           <List />
         </Loading>
       </>
-    </ThemeCtx>
+    </>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs ThemeCtx
<job>/source/App.tsx:13:17 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: ThemeCtx.
  related: <job>/source/index.tsx:3:15: The app is rendered here. does not suspend; can fail with Error; does not wait; needs ThemeCtx
solid-yield check: 3 files, 2 errors
```

### F-M115: M0357 delete-loading at reviewer-s2c_noerrored/App.tsx:27 (detected elsewhere)

Expected in the mutated routine (lines 22–33): PENDING_ROOT.

```diff
--- reviewer-s2c_noerrored/App.tsx
+++ reviewer-s2c_noerrored/App.tsx (mutant)
@@ -24,9 +24,9 @@
     <ThemeCtx value="dark">
       <Counter />
       <>
-        <Loading fallback="loading…">
+        <>
           <List />
-        </Loading>
+        </>
       </>
     </ThemeCtx>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:18 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Error.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); can fail with Error; does not wait; needs no context
<job>/source/App.tsx:17:18 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/index.tsx:3:15: The app is rendered here. can suspend (pending); can fail with Error; does not wait; needs no context
solid-yield check: 3 files, 2 errors
```

### F-M116: M0363 non-core-cache at review-slots-pending-root/App.tsx:4 (different code)

Expected in the mutated routine (lines 3–6): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- review-slots-pending-root/App.tsx
+++ review-slots-pending-root/App.tsx (mutant)
@@ -1,7 +1,7 @@
 import { createSignal, createMemo, createEffect, For, Show, Loading, createContext, useContext } from "solid-js";
 import { render } from '@solidjs/web';
 function App() {
-  const n = createMemo(async () => 1);
+  const n = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(async () => 1);
   return <p>{n()}</p>;
 }
 render(App, document.body);
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:3:10 error TS2345: [generated] [WRITE_IN_REACTIVE] Move this write into an event or effect; a memo or JSX read cannot write state.
solid-yield check: 1 files, 1 errors
```

### F-M117: M0367 non-core-cache at review-slots-colored-prop/App.tsx:8 (different code)

Expected in the mutated routine (lines 7–10): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- review-slots-colored-prop/App.tsx
+++ review-slots-colored-prop/App.tsx (mutant)
@@ -5,6 +5,6 @@
   return <p>{p.n}</p>;
 }
 export function App() {
-  const n = createMemo(async () => 1);
+  const n = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(async () => 1);
   return <Child n={n()} />;
 }
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:9:17 error TS2322: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
  related: <job>/source/App.tsx:3:3: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 1 files, 1 errors
```

### F-M118: M0373 delete-provider at review-slots-context/App.tsx:8 (silent)

Expected in the mutated routine (lines 7–9): NO_PROVIDER.

```diff
--- review-slots-context/App.tsx
+++ review-slots-context/App.tsx (mutant)
@@ -5,5 +5,5 @@
   return <p>{n}</p>;
 }
 export function App() {
-  return <C value={1}><Child /></C>;
+  return <><Child /></>;
 }
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 1 files, 0 errors
```

### F-M119: M0374 delete-loading at review-slots-lazy-child/App.tsx:3 (silent)

Expected in the mutated routine (lines 2–4): PENDING_ROOT.

```diff
--- review-slots-lazy-child/App.tsx
+++ review-slots-lazy-child/App.tsx (mutant)
@@ -1,4 +1,4 @@
 import { createSignal, createMemo, createEffect, For, Show, Loading, createContext, useContext } from "solid-js";
 export function App() {
-  return <Loading fallback={<p>wait</p>}><p>ready</p></Loading>;
+  return <><p>ready</p></>;
 }
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 1 files, 0 errors
```

### F-M120: M0376 delete-catch at review-slots-catch/App.tsx:5 (silent)

Expected in the mutated routine (lines 2–11): FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE, EVENT_REJECTS.

```diff
--- review-slots-catch/App.tsx
+++ review-slots-catch/App.tsx (mutant)
@@ -2,10 +2,10 @@
 export function Counter() {
   const [count, set] = createSignal(0);
   return <button onClick={() => {
-    try {
+    {
       set(1);
-    } catch {
-      set(2);
     }
+
+
   }} />;
 }
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 1 files, 0 errors
```

### F-M121: M0390 non-core-cache at operator-seeds/App.tsx:13 (masked: base errors)

Expected in the mutated routine (lines 11–28): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -10,7 +10,7 @@
 }
 function App() {
   const [count, setCount] = createSignal(1);
-  const value = createMemo(async () => {
+  const value = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(async () => {
     try { return await readServer(); } catch (e) { throw e; }
   });
   const twice = createMemo(() => count() * 2);
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:25:22 error TS95000: [EVENT_REJECTS] This handler can fail with Problem and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 2 files, 1 errors
```

### F-M122: M0393 remove-await at operator-seeds/App.tsx:14 (masked: base errors)

Expected in the mutated routine (lines 11–28): TS2322, TS2345, TS2739, TS2740, TS2741, TS2339, GENERATED_TYPE, SETTLED_PROP.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -11,7 +11,7 @@
 function App() {
   const [count, setCount] = createSignal(1);
   const value = createMemo(async () => {
-    try { return await readServer(); } catch (e) { throw e; }
+    try { return readServer(); } catch (e) { throw e; }
   });
   const twice = createMemo(() => count() * 2);
   createEffect(() => count(), n => { setCount(n); });
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:25:22 error TS95000: [EVENT_REJECTS] This handler can fail with Problem and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 2 files, 1 errors
```

### F-M123: M0402 delete-provider at operator-seeds/App.tsx:23 (detected elsewhere)

Expected in the mutated routine (lines 11–28): NO_PROVIDER.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -20,10 +20,10 @@
     await Promise.resolve();
     setCount(count() + 1);
   };
-  return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
+  return <><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
     <button onClick={async () => { await save(); }}>{twice()}</button>
     <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
     <Child value={count()} /><p>{value()}</p>
-  </Loading></Errored></Identity>;
+  </Loading></Errored></>;
 }
 render(() => <App />, document.body);
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:25:22 error TS95000: [EVENT_REJECTS] This handler can fail with Problem and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/App.tsx:8:20 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: Identity.
  related: <job>/source/App.tsx:29:15: The app is rendered here. does not suspend; never fails; does not wait; needs Identity
solid-yield check: 2 files, 2 errors
```

### F-M124: M0403 delete-errored at operator-seeds/App.tsx:23 (masked: base errors)

Expected in the mutated routine (lines 11–28): FOREIGN_HANDOFF.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -20,10 +20,10 @@
     await Promise.resolve();
     setCount(count() + 1);
   };
-  return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
+  return <Identity value={1}><><Loading fallback="wait">
     <button onClick={async () => { await save(); }}>{twice()}</button>
     <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
     <Child value={count()} /><p>{value()}</p>
-  </Loading></Errored></Identity>;
+  </Loading></></Identity>;
 }
 render(() => <App />, document.body);
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:25:22 error TS95000: [EVENT_REJECTS] This handler can fail with Problem and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/App.tsx:29:15: The app is rendered here.
solid-yield check: 2 files, 1 errors
```

### F-M125: M0416 server-new-class at operator-seeds/server.ts:5 (masked: base errors)

Expected in the mutated routine (lines 2–7): FOREIGN_HANDOFF.

```diff
--- operator-seeds/server.ts
+++ operator-seeds/server.ts (mutant)
@@ -2,6 +2,6 @@
 export async function readServer() {
   'use server';
   await Promise.resolve();
-  if (false) throw new ServerProblem('server');
+  if (false) throw new (class MutantFailure extends Error {})();
   return 1;
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:25:22 error TS95000: [EVENT_REJECTS] This handler can fail with Problem and nothing catches it; wrap the body in try/catch, or declare the failure.
solid-yield check: 2 files, 1 errors
```

### F-M126: M0420 delete-errored at sugar-edges/App.tsx:20 (detected elsewhere)

Expected in the mutated routine (lines 16–25): FOREIGN_HANDOFF.

```diff
--- sugar-edges/App.tsx
+++ sugar-edges/App.tsx (mutant)
@@ -17,9 +17,9 @@
   return (
     <section>
       <h2>{props.title.toLowerCase()}</h2>
-      <Errored fallback={error => <p role="alert">{String(error())}</p>}>
+      <>
         <Loading fallback="loading">{props.children}</Loading>
-      </Errored>
+      </>
     </section>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:47:16 error TS2345: [FOREIGN_HANDOFF] Wrap this rendered work in Errored, or handle the failure with attempt. Remaining: Missing | unknown.
  related: <job>/source/App.tsx:79:15: The app is rendered here. does not suspend; can fail with Missing | an unknown error; does not wait; needs no context
solid-yield check: 4 files, 1 errors
```

### F-M127: M0421 delete-loading at sugar-edges/App.tsx:21 (detected elsewhere)

Expected in the mutated routine (lines 16–25): PENDING_ROOT.

```diff
--- sugar-edges/App.tsx
+++ sugar-edges/App.tsx (mutant)
@@ -18,7 +18,7 @@
     <section>
       <h2>{props.title.toLowerCase()}</h2>
       <Errored fallback={error => <p role="alert">{String(error())}</p>}>
-        <Loading fallback="loading">{props.children}</Loading>
+        <>{props.children}</>
       </Errored>
     </section>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:47:16 error TS1360: [PENDING_ROOT] Wrap this read in Loading; it can suspend while waiting for data.
  related: <job>/source/App.tsx:79:15: The app is rendered here. can suspend (pending); never fails; does not wait; needs no context
solid-yield check: 4 files, 1 errors
```

### F-M128: M0445 delete-provider at sugar-edges/filters.tsx:11 (detected elsewhere)

Expected in the mutated routine (lines 9–12): NO_PROVIDER.

```diff
--- sugar-edges/filters.tsx
+++ sugar-edges/filters.tsx (mutant)
@@ -8,7 +8,7 @@
 const FilterContext = createContext<Filters>();
 export function FilterProvider(props: { children: JSX.Element }) {
   const [range, setRange] = createSignal("24h");
-  return <FilterContext value={{ range, setRange }}>{props.children}</FilterContext>;
+  return <>{props.children}</>;
 }
 export function useFilters() {
   const value = useContext(FilterContext);
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/filters.tsx:25:47 error TS95000: [EVENT_REJECTS] This handler can fail with unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
  related: <job>/source/App.tsx:79:15: The app is rendered here.
<job>/source/filters.tsx:23:19 error TS1360: [NO_PROVIDER] Add a context provider above this component; this context has no default value. Missing: FilterContext.
  related: <job>/source/App.tsx:79:15: The app is rendered here. does not suspend; can fail with an unknown error; does not wait; needs FilterContext
solid-yield check: 4 files, 2 errors
```

### F-M129: M0453 non-core-cache at rendering-edges/Feed.tsx:42 (different code)

Expected in the mutated routine (lines 29–72): SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- rendering-edges/Feed.tsx
+++ rendering-edges/Feed.tsx (mutant)
@@ -39,7 +39,7 @@
     { seedLoadingValue: true }
   );
   // F-S53: async iterable producers; a projection's draft; Repeat's index as a key.
-  const all = createMemo<Item[]>(async function* () {
+  const all = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })<Item[]>(async function* () {
     let seen: Item[] = [];
     for await (const item of items()) yield (seen = [...seen, item]);
   });
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/Feed.tsx:58:48 error TS2339: [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
<job>/source/Feed.tsx:42:87 error TS2558: Expected 0 type arguments, but got 1.
solid-yield check: 5 files, 2 errors
```

### F-M130: M0455 delete-loading at rendering-edges/Feed.tsx:56 (silent)

Expected in the mutated routine (lines 29–72): PENDING_ROOT.

```diff
--- rendering-edges/Feed.tsx
+++ rendering-edges/Feed.tsx (mutant)
@@ -53,7 +53,7 @@
     <section class={{ busy: isPending(() => feed.items) }}>
       <h2>{feed.title}</h2>
       <button onClick={() => setVersion(v => v + 1)}>refetch</button>
-      <Loading fallback="…">
+      <>
         <ul>
           <For each={all()}>{item => <li>{item.text}</li>}</For>
         </ul>
@@ -66,7 +66,7 @@
             )}
           </Repeat>
         </ol>
-      </Loading>
+      </>
     </section>
   );
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 5 files, 0 errors
```

### F-M131: M0461 delete-provider at rendering-edges/router.tsx:17 (detected elsewhere)

Expected in the mutated routine (lines 10–22): NO_PROVIDER.

```diff
--- rendering-edges/router.tsx
+++ rendering-edges/router.tsx (mutant)
@@ -14,9 +14,9 @@
     const is = (match: string) => match === path();
     window.onpopstate = () => go(location.pathname);
     return (
-      <RouterContext value={[path, { go, is }]}>
+      <>
         <Page />
-      </RouterContext>
+      </>
     );
   };
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/main.tsx:8:5 error TS2345: [NO_PROVIDER] Fix the earlier errors in this component before checking its render call. Missing: any.
<job>/source/router.tsx:36:16 error TS95000: [EVENT_REJECTS] This handler can fail with unknown and nothing catches it; wrap the body in try/catch, or declare the failure.
<job>/source/router.tsx:30:17 error TS2345: [generated] [GENERATED_TYPE] Check this operation and the function containing it; the generated code cannot accept it. Check the operation and its enclosing host.
solid-yield check: 5 files, 3 errors
```

## Findings list

- F-M1–F-M131: 131 survivors of the gate's rule, each with its category, full diff and actual diagnostics above.
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
