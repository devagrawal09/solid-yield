# Mutation report

Measured 2026-10-08T13:52:08.150Z. Checker source unchanged from the starting revision. No new checker tests were added. The five new tests verify the mutation harness, not the checker.

## Commands and scope

```sh
npm install --prefix scripts/mutation/tools --ignore-scripts
node --test scripts/mutation/test.mjs
node scripts/mutation/run.mjs
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-eslint.config.mjs
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-ts.config.mjs
```

Program run: 1484.4 seconds; 39 projects; 416 mutants. Digest: `846fd8ee2465e6bdb6cd309c908d7b6097c29b2e1bf23870fca5f045fad7a4ad`.

Every syntactically applicable site is edited separately. Sources stay plain Solid; no checker fixes were made. Each pipeline runs the shared native transform, the exported implementation used by `solid-yield check`, and recommended ESLint on generated code. A transform refusal blocks generated lint and is recorded explicitly. A CLI crash is a finding, never a kill.

A kill needs an expected diagnostic code at the exact edited file and authored line (±0), exactly as requested. Generated lint uses the transform position table. Existing diagnostics in broken base programs count if they match the exact line/code rule; those matches are flagged separately in the JSON evidence. A diagnostic at another line, even a correct root/handoff error, is a survivor. “Equivalent” means diagnostic-equivalent under the documented design, not identical runtime behavior. Equivalent edits are still run through the pipeline. Warnings are recorded; only a code in the fixed expected set can kill.

The gate runs `node scripts/mutation/run.mjs --cached --baseline documentation/yield-gate-baseline.json`. The cache hashes corpus content, mutation implementation, checker sources, library declarations/output and dependency lockfile. It is a local speed aid, not a committed result substitute: fresh checkouts run all pipelines. Any hashed change forces a fresh run. The gate checks the initial score and per-operator site floors; no checker behavior was changed to raise this baseline.

## Program mutants

| Operator | Mutants | Killed | Survived | Equivalent | Score | Expected codes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| delete-catch | 9 | 0 | 9 | 0 | 0.00% | FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE |
| swallow-catch | 2 | 0 | 0 | 2 | n/a | equivalent |
| delete-errored | 19 | 0 | 19 | 0 | 0.00% | FOREIGN_HANDOFF |
| delete-loading | 21 | 0 | 21 | 0 | 0.00% | PENDING_ROOT |
| setup-read | 110 | 88 | 22 | 0 | 80.00% | READ_IN_SETUP, solid-yield/no-read-in-setup |
| delete-provider | 20 | 0 | 20 | 0 | 0.00% | NO_PROVIDER |
| never-provided-context | 26 | 0 | 26 | 0 | 0.00% | NO_PROVIDER |
| throw-string | 24 | 0 | 0 | 24 | n/a | equivalent |
| throw-object | 24 | 0 | 0 | 24 | n/a | equivalent |
| async-reject | 3 | 0 | 3 | 0 | 0.00% | FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE |
| remove-await | 27 | 0 | 27 | 0 | 0.00% | TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP |
| memo-write | 23 | 20 | 3 | 0 | 86.96% | WRITE_IN_REACTIVE, solid-yield/no-unyielded-write |
| timer-read | 6 | 0 | 0 | 6 | n/a | equivalent |
| non-core-cache | 43 | 15 | 28 | 0 | 34.88% | SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP |
| destructure-props | 7 | 0 | 7 | 0 | 0.00% | NATIVE_PROPS |
| inline-component | 46 | 1 | 45 | 0 | 2.17% | NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF |
| effect-arity | 4 | 4 | 0 | 0 | 100.00% | NATIVE_EFFECT_PHASES, TS2554 |
| remove-use-server | 1 | 0 | 0 | 1 | n/a | equivalent |
| server-new-class | 1 | 0 | 1 | 0 | 0.00% | FOREIGN_HANDOFF |

**Program mutation score: 35.65% = 128 / (128 + 231).** 57 equivalents excluded.

### Catalogue and equivalent rules

- **delete-catch:** Remove one catch; retain try body and finally.
- **swallow-catch:** Remove each direct rethrow in a catch. Equivalent reason: A catch may deliberately handle a failure. Removing a rethrow is permitted handling, not a checker error.
- **delete-errored:** Remove Errored tags, retain children.
- **delete-loading:** Remove Loading tags, retain children.
- **setup-read:** Hoist each signal/memo read from JSX or a memo to its enclosing component setup.
- **delete-provider:** Remove a locally declared context provider, retain children.
- **never-provided-context:** Replace each context argument with a fresh context.
- **throw-string:** Replace each constructed class throw with a string. Equivalent reason: Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.
- **throw-object:** Replace each constructed class throw with an object. Equivalent reason: Unknown thrown values are allowed by the unknown floor; changing the value is not itself an error. Handoff diagnostics are still recorded.
- **async-reject:** Insert throw new Error after each await statement in an async JSX event callback.
- **remove-await:** Replace each await expression with its operand.
- **memo-write:** Insert a write to each visible signal setter in each memo callback.
- **timer-read:** Insert a settled signal read in each setup-time timer/listener callback. Equivalent reason: A settled signal read in an ignored timer/listener callback is an allowed event read. Failure diagnostics remain recorded.
- **non-core-cache:** Replace createMemo with an inline hand-rolled last-value cache.
- **destructure-props:** Destructure each directly read property in a component parameter; rewrite its references. Parameter snapshots are currently refused (setup snapshots are valid).
- **inline-component:** Define an inline copy at every JSX use of a local component, and use that copy at the edited site. Other callers and exports remain valid.
- **effect-arity:** Remove all but the compute argument (or the only argument).
- **remove-use-server:** Remove each use server directive. Equivalent reason: Removing a server directive changes transport behavior but remains a valid local function; no checker error is required.
- **server-new-class:** Replace each server-function throw with an instance of a fresh local class.

### Corpus provenance

The reviewer app and all 17 stored variants are verbatim snapshots under `scripts/mutation/corpus/reviewer`. They include all twelve numbered mistakes plus the boundary removals and throw variants. Historical programs come from `scripts/native/fixtures.mjs`: 18 reconstructed programs cover the 27 recoverable slots; T12–T15 and R10–R12 remain unavailable. The original two apps are read directly from their unchanged repository sources. Two seed files ensure all 19 operators have sites.

| Project | Files | Base transform / CLI / lint | Origin |
| --- | ---: | --- | --- |
| sierpinski | 1 | completed / passed / passed | examples/originals/sierpinski/src (verbatim) |
| todos | 5 | completed / passed / diagnostics | examples/originals/todos/src (verbatim) |
| reviewer-myapp | 3 | completed / passed / passed | /private/tmp/sy-review-out/myapp/src (verbatim snapshot) |
| reviewer-m01_setup_read | 3 | completed / diagnostics / diagnostics | /private/tmp/sy-review-out/variants/m01_setup_read.tsx (verbatim snapshot) |
| reviewer-m02_noprovider2 | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m02_noprovider2.tsx (verbatim snapshot) |
| reviewer-m03_throw_string | 3 | refused / diagnostics / blocked-by-transform | /private/tmp/sy-review-out/variants/m03_throw_string.tsx (verbatim snapshot) |
| reviewer-m03b_throw_in_memo | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m03b_throw_in_memo.tsx (verbatim snapshot) |
| reviewer-m03c_throw_in_handler | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m03c_throw_in_handler.tsx (verbatim snapshot) |
| reviewer-m04_async_handler | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m04_async_handler.tsx (verbatim snapshot) |
| reviewer-m05_swallow | 3 | completed / passed / passed | /private/tmp/sy-review-out/variants/m05_swallow.tsx (verbatim snapshot) |
| reviewer-m06_memo_writes | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m06_memo_writes.tsx (verbatim snapshot) |
| reviewer-m07_timeout_read | 3 | completed / diagnostics / passed | /private/tmp/sy-review-out/variants/m07_timeout_read.tsx (verbatim snapshot) |
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
| review-slots-colored-prop | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots T08 |
| review-slots-throw-error | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T09, R03 |
| review-slots-context | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T10 |
| review-slots-lazy-child | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots T11 |
| review-slots-eager-jsx | 1 | completed / diagnostics / diagnostics | scripts/native/fixtures.mjs; reconstructed slots L05 |
| review-slots-catch | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots L06 |
| review-slots-memo-write | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots R05 |
| review-slots-hole-create | 1 | refused / diagnostics / blocked-by-transform | scripts/native/fixtures.mjs; reconstructed slots R06 |
| review-slots-async-effect | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots R07 |
| review-slots-missing-context | 1 | completed / diagnostics / passed | scripts/native/fixtures.mjs; reconstructed slots R08 |
| review-slots-unhandled-failure | 1 | completed / passed / passed | scripts/native/fixtures.mjs; reconstructed slots R09 |
| operator-seeds | 2 | completed / diagnostics / passed | Additional plain Solid controls for catch, async event and server sites |

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

### F-M1: M0001 non-core-cache at sierpinski/main.tsx:16

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -13,7 +13,7 @@
 const TriangleDemo = () => {
   const [elapsed, setElapsed] = createSignal(0),
     [seconds, setSeconds] = createSignal(0),
-    scale = createMemo(() => {
+    scale = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => {
       const e = (elapsed() / 1000) % 10;
       return 1 + (e > 5 ? 10 - e : e) / 10;
     }),
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/main.tsx:17:18 error TS95000: [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole.
solid-yield check: 1 files, 1 errors
transform main.tsx:26 [SUGAR_CALLBACK] [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (<job>/source/main.tsx:26:17)
```

### F-M2: M0009 delete-loading at sierpinski/main.tsx:36

Expected at this exact line: PENDING_ROOT.

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
<job>/source/main.tsx:115:8 error TS1360: [PENDING_ROOT] Component TriangleDemo: pending true; fails unknown; may-wait true; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 1 files, 1 errors
```

### F-M3: M0012 destructure-props at sierpinski/main.tsx:51

Expected at this exact line: NATIVE_PROPS.

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

### F-M4: M0013 inline-component at sierpinski/main.tsx:13

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -10,7 +10,7 @@
 
 const TARGET = 25;
 
-const TriangleDemo = () => {
+const TriangleDemo = () => {const MutantInline1006=(props:TriangleProps)=>{let{x,y,s}=props;if(s<=TARGET){return<Dot x={x-TARGET/2}y={y-TARGET/2}s={TARGET}> {props.children} </Dot>;}s=s/2;const slowChildren=createMemo(()=>{const seconds=props.children;return new Promise<number>(res=>{const t=requestIdleCallback(()=>{const e=performance.now()+0.8;while(performance.now()<e){}res(seconds);});onCleanup(()=>cancelIdleCallback(t));});});return<> <Triangle x={x}y={y-s/2}s={s}> {slowChildren()} </Triangle> <Triangle x={x-s}y={y+s/2}s={s}> {slowChildren()} </Triangle> <Triangle x={x+s}y={y+s/2}s={s}> {slowChildren()} </Triangle> </>;};
   const [elapsed, setElapsed] = createSignal(0),
     [seconds, setSeconds] = createSignal(0),
     scale = createMemo(() => {
@@ -40,9 +40,9 @@
           transform: "scaleX(" + scale() / 2.1 + ") scaleY(0.7) translateZ(0.1px)"
         }}
       >
-        <Triangle x={0} y={0} s={1000}>
+        <MutantInline1006 x={0} y={0} s={1000}>
           {seconds()}
-        </Triangle>
+        </MutantInline1006>
       </div>
     </Loading>
   );
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/main.tsx:1:1 error TS95000: [TRANSFORM] Snapshot Triangle.x is not a fixed numeric prop; ordered snapshot lowering is required. (<job>/source/main.tsx)
solid-yield check: 1 files, 1 errors
transform main.tsx:1 [NATIVE_RECURSION] [NATIVE_RECURSION] Snapshot Triangle.x is not a fixed numeric prop; ordered snapshot lowering is required. (<job>/source/main.tsx)
```

### F-M5: M0014 non-core-cache at sierpinski/main.tsx:62

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/main.tsx:63:21 error TS95000: [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole.
solid-yield check: 1 files, 1 errors
transform main.tsx:93 [SUGAR_CALLBACK] [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (<job>/source/main.tsx:93:35)
```

### F-M6: M0015 setup-read at sierpinski/main.tsx:74

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -71,10 +71,10 @@
     });
   });
 
-  return (
+  const __mutantSnapshot1756 = slowChildren(); return (
     <>
       <Triangle x={x} y={y - s / 2} s={s}>
-        {slowChildren()}
+        {__mutantSnapshot1756}
       </Triangle>
       <Triangle x={x - s} y={y + s / 2} s={s}>
         {slowChildren()}
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/main.tsx:51:7 error TS2589: [generated] Type instantiation is excessively deep and possibly infinite.
<job>/source/main.tsx:51:7 error TS2769: [generated] [LAZY_VIEW] fallback is a lazy view: function* () { return <.../>; }
solid-yield check: 1 files, 2 errors
lint main.tsx:51 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M7: M0016 setup-read at sierpinski/main.tsx:74

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -71,13 +71,13 @@
     });
   });
 
-  return (
+  const __mutantSnapshot1846 = slowChildren(); return (
     <>
       <Triangle x={x} y={y - s / 2} s={s}>
         {slowChildren()}
       </Triangle>
       <Triangle x={x - s} y={y + s / 2} s={s}>
-        {slowChildren()}
+        {__mutantSnapshot1846}
       </Triangle>
       <Triangle x={x + s} y={y + s / 2} s={s}>
         {slowChildren()}
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/main.tsx:51:7 error TS2589: [generated] Type instantiation is excessively deep and possibly infinite.
<job>/source/main.tsx:51:7 error TS2769: [generated] [LAZY_VIEW] fallback is a lazy view: function* () { return <.../>; }
solid-yield check: 1 files, 2 errors
lint main.tsx:51 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M8: M0017 setup-read at sierpinski/main.tsx:74

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -71,7 +71,7 @@
     });
   });
 
-  return (
+  const __mutantSnapshot1936 = slowChildren(); return (
     <>
       <Triangle x={x} y={y - s / 2} s={s}>
         {slowChildren()}
@@ -80,7 +80,7 @@
         {slowChildren()}
       </Triangle>
       <Triangle x={x + s} y={y + s / 2} s={s}>
-        {slowChildren()}
+        {__mutantSnapshot1936}
       </Triangle>
     </>
   );
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/main.tsx:51:7 error TS2589: [generated] Type instantiation is excessively deep and possibly infinite.
<job>/source/main.tsx:51:7 error TS2769: [generated] [LAZY_VIEW] fallback is a lazy view: function* () { return <.../>; }
solid-yield check: 1 files, 2 errors
lint main.tsx:51 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M9: M0018 destructure-props at sierpinski/main.tsx:89

Expected at this exact line: NATIVE_PROPS.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -86,7 +86,7 @@
   );
 };
 
-const Dot = (props: TriangleProps) => {
+const Dot = ({ children: __mutantProp2000, ...props }: TriangleProps) => {
   const { x, y, s } = props;
   const [hover, setHover] = createSignal(false),
     onEnter = () => setHover(true),
@@ -107,7 +107,7 @@
       onMouseEnter={onEnter}
       onMouseLeave={onExit}
     >
-      {hover() ? "**" + props.children + "**" : props.children}
+      {hover() ? "**" + __mutantProp2000 + "**" : __mutantProp2000}
     </div>
   );
 };
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/main.tsx:78:13 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 1 files, 1 errors
transform main.tsx:78 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M10: M0019 inline-component at sierpinski/main.tsx:51

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- sierpinski/main.tsx
+++ sierpinski/main.tsx (mutant)
@@ -48,13 +48,13 @@
   );
 };
 
-const Triangle = (props: TriangleProps) => {
+const Triangle = (props: TriangleProps) => {const MutantInline1229=(props:TriangleProps)=>{const{x,y,s}=props;const[hover,setHover]=createSignal(false),onEnter=()=>setHover(true),onExit=()=>setHover(false);return<div class="dot"style={{width:s+"px",height:s+"px",left:x+"px",top:y+"px","border-radius":s/2+"px","line-height":s+"px",background:hover()?"#ff0":"#61dafb"}}onMouseEnter={onEnter}onMouseLeave={onExit}> {hover()?"**"+props.children+"**":props.children} </div>;};
   let { x, y, s } = props;
   if (s <= TARGET) {
     return (
-      <Dot x={x - TARGET / 2} y={y - TARGET / 2} s={TARGET}>
+      <MutantInline1229 x={x - TARGET / 2} y={y - TARGET / 2} s={TARGET}>
         {props.children}
-      </Dot>
+      </MutantInline1229>
     );
   }
   s = s / 2;
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/main.tsx:51:7 error TS2322: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/main.tsx:51:7 error TS2345: [generated] [CREATE_OUTSIDE_SETUP] Create reactive state in component setup, not in a JSX hole.
<job>/source/main.tsx:51:7 error TS2322: [generated] [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 1 files, 3 errors
lint main.tsx:51 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
lint main.tsx:51 [solid-yield/no-read-in-prop] read in a prop: pass the source (`x: src`), or a hole (`x: function* () { return …; }`) the component reads (D-065).
lint main.tsx:51 [solid-yield/no-read-in-prop] read in a prop: pass the source (`y: src`), or a hole (`y: function* () { return …; }`) the component reads (D-065).
```

### F-M11: M0022 remove-await at todos/api.ts:23

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- todos/api.ts
+++ todos/api.ts (mutant)
@@ -20,7 +20,7 @@
     const index = todos.findIndex(t => t.id > newTodo.id);
     if (index > -1) todos.splice(index, 0, newTodo);
     else todos.push(newTodo);
-    await saveTodos(todos);
+    saveTodos(todos);
     return newTodo;
   },
   async removeTodo(todoId: string) {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M12: M0023 remove-await at todos/api.ts:36

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- todos/api.ts
+++ todos/api.ts (mutant)
@@ -33,7 +33,7 @@
       return (found = { ...t, completed });
     });
     if (!found) return reject(400);
-    await saveTodos(todos);
+    saveTodos(todos);
     return found;
   },
   async toggleAll(ids: string[], completed: boolean) {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M13: M0024 inline-component at todos/app.tsx:130

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -127,7 +127,7 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline4197(){const[,{addTodo}]=useContext(TodosContext);return<header class="header"> <h1>todos</h1> <input class="new-todo"placeholder="What needs to be done?"autofocus onKeyDown={e=>{if(e.key!=="Enter")return;const title=e.currentTarget.value.trim();if(!title)return;const id=`${Date.now()}-${Math.random().toString(36).slice(2,7)}`;addTodo({id,title,completed:false});e.currentTarget.value="";}}/> </header>;}
   const filter = createHashFilter();
   return (
     <Errored
@@ -140,7 +140,7 @@
     >
       <TodosContext value={createTodos()}>
         <section class="todoapp">
-          <Header />
+          <MutantInline4197 />
           <Loading fallback={<p class="loading">Loading…</p>}>
             <MainSection filter={filter()} />
             <Footer filter={filter()} />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/app.tsx:130:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 5 files, 1 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
lint app.tsx:130 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M14: M0025 never-provided-context at todos/app.tsx:8

Expected at this exact line: NO_PROVIDER.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -5,7 +5,7 @@
 const TodosContext = createContext<ReturnType<typeof createTodos>>();
 
 function Header() {
-  const [, { addTodo }] = useContext(TodosContext);
+  const [, { addTodo }] = useContext(createContext<number>());
   return (
     <header class="header">
       <h1>todos</h1>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/app.tsx:8:31 error TS95000: [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
solid-yield check: 5 files, 1 errors
transform app.tsx:8 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
```

### F-M15: M0026 destructure-props at todos/app.tsx:29

Expected at this exact line: NATIVE_PROPS.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -26,16 +26,16 @@
   );
 }
 
-function TodoItem(props: { todo: Todo }) {
+function TodoItem({ todo: __mutantProp877, ...props }: { todo: Todo }) {
   const [, { toggleTodo, removeTodo, retryTodo }] = useContext(TodosContext);
   return (
     <li
       class={[
         "todo",
         {
-          completed: props.todo.completed,
-          pending: !!props.todo.pending,
-          errored: !!props.todo.error
+          completed: __mutantProp877.completed,
+          pending: !!__mutantProp877.pending,
+          errored: !!__mutantProp877.error
         }
       ]}
     >
@@ -43,20 +43,20 @@
         <input
           class="toggle"
           type="checkbox"
-          checked={props.todo.completed}
-          onInput={e => toggleTodo(props.todo.id, e.currentTarget.checked)}
+          checked={__mutantProp877.completed}
+          onInput={e => toggleTodo(__mutantProp877.id, e.currentTarget.checked)}
         />
-        <label>{props.todo.title}</label>
-        <Show when={props.todo.error}>
+        <label>{__mutantProp877.title}</label>
+        <Show when={__mutantProp877.error}>
           {error => (
             <button
               class="retry"
               title={`Retry ${error().type}`}
-              onClick={() => retryTodo(props.todo)}
+              onClick={() => retryTodo(__mutantProp877)}
             />
           )}
         </Show>
-        <button class="destroy" onClick={() => removeTodo(props.todo.id)} />
+        <button class="destroy" onClick={() => removeTodo(__mutantProp877.id)} />
       </div>
     </li>
   );
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/app.tsx:26:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 5 files, 1 errors
transform app.tsx:26 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M16: M0028 never-provided-context at todos/app.tsx:30

Expected at this exact line: NO_PROVIDER.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -27,7 +27,7 @@
 }
 
 function TodoItem(props: { todo: Todo }) {
-  const [, { toggleTodo, removeTodo, retryTodo }] = useContext(TodosContext);
+  const [, { toggleTodo, removeTodo, retryTodo }] = useContext(createContext<number>());
   return (
     <li
       class={[
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/app.tsx:29:32 error TS95000: [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
solid-yield check: 5 files, 1 errors
transform app.tsx:29 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
```

### F-M17: M0029 destructure-props at todos/app.tsx:65

Expected at this exact line: NATIVE_PROPS.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -62,10 +62,10 @@
   );
 }
 
-function MainSection(props: { filter: Filter }) {
+function MainSection({ filter: __mutantProp1828, ...props }: { filter: Filter }) {
   const [todos, { toggleAll }] = useContext(TodosContext);
   const filtered = () => {
-    const f = props.filter;
+    const f = __mutantProp1828;
     if (f === "active") return todos.filter(x => !x.completed);
     if (f === "completed") return todos.filter(x => x.completed);
     return todos;
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/app.tsx:61:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 5 files, 1 errors
transform app.tsx:61 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M18: M0030 inline-component at todos/app.tsx:130

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -127,7 +127,7 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline4283(props:{filter:Filter;}){const[todos,{toggleAll}]=useContext(TodosContext);const filtered=()=>{const f=props.filter;if(f==="active")return todos.filter(x=>!x.completed);if(f==="completed")return todos.filter(x=>x.completed);return todos;};const allCompleted=()=>todos.length>0&&todos.every(x=>x.completed);return<Show when={todos.length>0}> <section class="main"> <input id="toggle-all"class="toggle-all"type="checkbox"checked={allCompleted()}onChange={()=>toggleAll(!allCompleted())}/> <label for="toggle-all">Mark all as complete</label> <ul class="todo-list"> <For each={filtered()}>{todo=><TodoItem todo={todo}/>}</For> </ul> </section> </Show>;}
   const filter = createHashFilter();
   return (
     <Errored
@@ -142,7 +142,7 @@
         <section class="todoapp">
           <Header />
           <Loading fallback={<p class="loading">Loading…</p>}>
-            <MainSection filter={filter()} />
+            <MutantInline4283 filter={filter()} />
             <Footer filter={filter()} />
           </Loading>
         </section>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
lint app.tsx:130 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
lint app.tsx:130 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
               ...`, D-075).
lint app.tsx:130 [solid-yield/no-read-in-prop] read in a prop: pass the source (`filter: src`), or a hole (`filter: function* () { return …; }`) the component reads (D-065).
```

### F-M19: M0031 never-provided-context at todos/app.tsx:66

Expected at this exact line: NO_PROVIDER.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -63,7 +63,7 @@
 }
 
 function MainSection(props: { filter: Filter }) {
-  const [todos, { toggleAll }] = useContext(TodosContext);
+  const [todos, { toggleAll }] = useContext(createContext<number>());
   const filtered = () => {
     const f = props.filter;
     if (f === "active") return todos.filter(x => !x.completed);
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform app.tsx:64 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M20: M0032 destructure-props at todos/app.tsx:93

Expected at this exact line: NATIVE_PROPS.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -90,7 +90,7 @@
   );
 }
 
-function Footer(props: { filter: Filter }) {
+function Footer({ filter: __mutantProp2708, ...props }: { filter: Filter }) {
   const [todos, { clearCompleted }] = useContext(TodosContext);
   const remaining = () => todos.filter(x => !x.completed).length;
   const completed = () => todos.length - remaining();
@@ -102,17 +102,17 @@
         </span>
         <ul class="filters">
           <li>
-            <a href="#/" class={{ selected: props.filter === "all" }}>
+            <a href="#/" class={{ selected: __mutantProp2708 === "all" }}>
               All
             </a>
           </li>
           <li>
-            <a href="#/active" class={{ selected: props.filter === "active" }}>
+            <a href="#/active" class={{ selected: __mutantProp2708 === "active" }}>
               Active
             </a>
           </li>
           <li>
-            <a href="#/completed" class={{ selected: props.filter === "completed" }}>
+            <a href="#/completed" class={{ selected: __mutantProp2708 === "completed" }}>
               Completed
             </a>
           </li>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/app.tsx:88:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 5 files, 1 errors
transform app.tsx:88 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M21: M0033 inline-component at todos/app.tsx:130

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -127,7 +127,7 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline4329(props:{filter:Filter;}){const[todos,{clearCompleted}]=useContext(TodosContext);const remaining=()=>todos.filter(x=>!x.completed).length;const completed=()=>todos.length-remaining();return<Show when={todos.length>0}> <footer class="footer"> <span class="todo-count"> <strong>{remaining()}</strong> {remaining()===1?"item":"items"} left </span> <ul class="filters"> <li> <a href="#/"class={{selected:props.filter==="all"}}> All </a> </li> <li> <a href="#/active"class={{selected:props.filter==="active"}}> Active </a> </li> <li> <a href="#/completed"class={{selected:props.filter==="completed"}}> Completed </a> </li> </ul> <Show when={completed()>0}> <button class="clear-completed"onClick={clearCompleted}> Clear completed </button> </Show> </footer> </Show>;}
   const filter = createHashFilter();
   return (
     <Errored
@@ -143,7 +143,7 @@
           <Header />
           <Loading fallback={<p class="loading">Loading…</p>}>
             <MainSection filter={filter()} />
-            <Footer filter={filter()} />
+            <MutantInline4329 filter={filter()} />
           </Loading>
         </section>
       </TodosContext>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
lint app.tsx:130 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
lint app.tsx:130 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
lint app.tsx:130 [solid-yield/no-read-in-prop] read in a prop: pass the source (`filter: src`), or a hole (`filter: function* () { return …; }`) the component reads (D-065).
```

### F-M22: M0034 never-provided-context at todos/app.tsx:94

Expected at this exact line: NO_PROVIDER.

```diff
--- todos/app.tsx
+++ todos/app.tsx (mutant)
@@ -91,7 +91,7 @@
 }
 
 function Footer(props: { filter: Filter }) {
-  const [todos, { clearCompleted }] = useContext(TodosContext);
+  const [todos, { clearCompleted }] = useContext(createContext<number>());
   const remaining = () => todos.filter(x => !x.completed).length;
   const completed = () => todos.length - remaining();
   return (
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform app.tsx:91 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M23: M0035 delete-errored at todos/app.tsx:133

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/main.tsx:4:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown; may-wait true; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 5 files, 1 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M24: M0036 delete-provider at todos/app.tsx:141

Expected at this exact line: NO_PROVIDER.

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
<job>/source/main.tsx:4:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait true; requires TodosContext; The root requires a context; provide it above the component that reads it.
solid-yield check: 5 files, 1 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M25: M0037 delete-loading at todos/app.tsx:144

Expected at this exact line: PENDING_ROOT.

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
<job>/source/main.tsx:4:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait true; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 5 files, 1 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M26: M0038 remove-await at todos/todos.ts:87

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- todos/todos.ts
+++ todos/todos.ts (mutant)
@@ -84,7 +84,7 @@
 
 export function createTodos() {
   const [todos, setTodos] = createOptimisticStore<Todo[]>(async () => {
-    const todos: Todo[] = await api.getTodos();
+    const todos: Todo[] = api.getTodos();
     applyErrors(todos, Errors);
     return todos;
   }, []);
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/todos.ts:87:11 error TS2740: Type 'Promise<Todo[]>' is missing the following properties from type 'Todo[]': length, pop, push, concat, and 35 more.
solid-yield check: 5 files, 1 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M27: M0039 delete-catch at todos/todos.ts:99

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

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
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M28: M0040 delete-catch at todos/todos.ts:109

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

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
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M29: M0041 delete-catch at todos/todos.ts:125

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

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
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M30: M0042 delete-catch at todos/todos.ts:144

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

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
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M31: M0043 delete-catch at todos/todos.ts:159

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

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
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 5 files, 0 errors
lint app.tsx:65 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* () {
              r...`, D-075).
lint app.tsx:93 [solid-yield/no-unshown-wait] this view binds a handler that may wait on pending data; show its in-flight state (`$event(function* (...args: __NativeAr...`, D-075).
```

### F-M32: M0044 inline-component at reviewer-myapp/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-myapp/App.tsx
+++ reviewer-myapp/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline674(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline674 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M33: M0051 inline-component at reviewer-myapp/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-myapp/App.tsx
+++ reviewer-myapp/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline797(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline797 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M34: M0052 never-provided-context at reviewer-myapp/App.tsx:13

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-myapp/App.tsx
+++ reviewer-myapp/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:12 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M35: M0053 non-core-cache at reviewer-myapp/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:16:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
```

### F-M36: M0055 delete-provider at reviewer-myapp/App.tsx:24

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
```

### F-M37: M0056 delete-errored at reviewer-myapp/App.tsx:26

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M38: M0057 delete-loading at reviewer-myapp/App.tsx:27

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 1 errors
```

### F-M39: M0058 remove-await at reviewer-myapp/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-myapp/api.ts
+++ reviewer-myapp/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 3 files, 0 errors
```

### F-M40: M0061 inline-component at reviewer-m01_setup_read/App.tsx:24

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -21,10 +21,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline727(){const[count,setCount]=createSignal(0);const snapshot=count();console.log(snapshot);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline727 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/App.tsx:24:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 3 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
lint App.tsx:24 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M41: M0064 setup-read at reviewer-m01_setup_read/App.tsx:11

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -7,8 +7,8 @@
   const [count, setCount] = createSignal(0);
   const snapshot = count();
   console.log(snapshot);
-  const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const twice = createMemo(() => __mutantSnapshot335 * 2);
+  const __mutantSnapshot335 = count(); return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M42: M0065 setup-read at reviewer-m01_setup_read/App.tsx:11

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -8,7 +8,7 @@
   const snapshot = count();
   console.log(snapshot);
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot390 = count(); return <button onClick={() => setCount(__mutantSnapshot390 + 1)}>{count()} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M43: M0066 setup-read at reviewer-m01_setup_read/App.tsx:11

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -8,7 +8,7 @@
   const snapshot = count();
   console.log(snapshot);
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot405 = count(); return <button onClick={() => setCount(count() + 1)}>{__mutantSnapshot405} / {twice()}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M44: M0067 setup-read at reviewer-m01_setup_read/App.tsx:11

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -8,7 +8,7 @@
   const snapshot = count();
   console.log(snapshot);
   const twice = createMemo(() => count() * 2);
-  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
+  const __mutantSnapshot417 = twice(); return <button onClick={() => setCount(count() + 1)}>{count()} / {__mutantSnapshot417}</button>;
 }
 
 function List() {
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M45: M0068 inline-component at reviewer-m01_setup_read/App.tsx:24

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -21,13 +21,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline850(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline850 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/App.tsx:24:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 3 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
lint App.tsx:24 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M46: M0069 never-provided-context at reviewer-m01_setup_read/App.tsx:15

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m01_setup_read/App.tsx
+++ reviewer-m01_setup_read/App.tsx (mutant)
@@ -12,7 +12,7 @@
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:14 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M47: M0070 non-core-cache at reviewer-m01_setup_read/App.tsx:16

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/App.tsx:18:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:19:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 4 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M48: M0072 delete-provider at reviewer-m01_setup_read/App.tsx:26

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M49: M0073 delete-errored at reviewer-m01_setup_read/App.tsx:28

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M50: M0074 delete-loading at reviewer-m01_setup_read/App.tsx:29

Expected at this exact line: PENDING_ROOT.

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
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails any; may-wait false; requires any; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 3 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M51: M0075 remove-await at reviewer-m01_setup_read/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m01_setup_read/api.ts
+++ reviewer-m01_setup_read/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:20 error TS2769: [READ_IN_SETUP] A setup creates; read this value in JSX, a memo, an effect, or an event.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:6 [READ_IN_SETUP] [READ_IN_SETUP] a setup creates; read this source in a view hole, a $memo, an $effect or an $event.
```

### F-M52: M0078 inline-component at reviewer-m02_noprovider2/App.tsx:24

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -21,10 +21,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline758(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline758 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:24:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires UserCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
lint App.tsx:24 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M53: M0085 inline-component at reviewer-m02_noprovider2/App.tsx:24

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -21,13 +21,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline881(){const theme=useContext(ThemeCtx);const user=useContext(UserCtx);const items=createMemo(()=>fetchItems());return<ul class={theme+user}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline881 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:24:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires UserCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
lint App.tsx:24 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M54: M0086 never-provided-context at reviewer-m02_noprovider2/App.tsx:14

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -11,7 +11,7 @@
 }
 
 function List() {
-  const theme = useContext(ThemeCtx);
+  const theme = useContext(createContext<number>());
   const user = useContext(UserCtx);
   const items = createMemo(() => fetchItems());
   return (
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:13 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M55: M0087 never-provided-context at reviewer-m02_noprovider2/App.tsx:15

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m02_noprovider2/App.tsx
+++ reviewer-m02_noprovider2/App.tsx (mutant)
@@ -12,7 +12,7 @@
 
 function List() {
   const theme = useContext(ThemeCtx);
-  const user = useContext(UserCtx);
+  const user = useContext(createContext<number>());
   const items = createMemo(() => fetchItems());
   return (
     <ul class={theme + user}>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:14:27 error TS95000: [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
solid-yield check: 3 files, 1 errors
transform App.tsx:14 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
```

### F-M56: M0088 non-core-cache at reviewer-m02_noprovider2/App.tsx:16

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:18:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:19:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
```

### F-M57: M0090 delete-provider at reviewer-m02_noprovider2/App.tsx:26

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx | UserCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
```

### F-M58: M0091 delete-errored at reviewer-m02_noprovider2/App.tsx:28

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires UserCtx; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails unknown | global:Error; may-wait false; requires UserCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
```

### F-M59: M0092 delete-loading at reviewer-m02_noprovider2/App.tsx:29

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending true; fails none; may-wait false; requires UserCtx; The root requires a context; provide it above the component that reads it.
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires UserCtx; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M60: M0093 remove-await at reviewer-m02_noprovider2/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m02_noprovider2/api.ts
+++ reviewer-m02_noprovider2/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires UserCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
```

### F-M61: M0096 inline-component at reviewer-m03_throw_string/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline712(){const[count,setCount]=createSignal(0);if(count()>100)throw'too big';const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline712 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M62: M0097 non-core-cache at reviewer-m03_throw_string/App.tsx:9

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M63: M0098 memo-write at reviewer-m03_throw_string/App.tsx:9

Expected at this exact line: WRITE_IN_REACTIVE, solid-yield/no-unyielded-write.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M64: M0099 setup-read at reviewer-m03_throw_string/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M65: M0100 setup-read at reviewer-m03_throw_string/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M66: M0101 setup-read at reviewer-m03_throw_string/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M67: M0102 setup-read at reviewer-m03_throw_string/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M68: M0103 inline-component at reviewer-m03_throw_string/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m03_throw_string/App.tsx
+++ reviewer-m03_throw_string/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline835(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline835 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M69: M0104 never-provided-context at reviewer-m03_throw_string/App.tsx:14

Expected at this exact line: NO_PROVIDER.

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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:13 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M70: M0105 non-core-cache at reviewer-m03_throw_string/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M71: M0106 setup-read at reviewer-m03_throw_string/App.tsx:16

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M72: M0107 delete-provider at reviewer-m03_throw_string/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M73: M0108 delete-errored at reviewer-m03_throw_string/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M74: M0109 delete-loading at reviewer-m03_throw_string/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M75: M0110 remove-await at reviewer-m03_throw_string/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m03_throw_string/api.ts
+++ reviewer-m03_throw_string/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_RETURN] A component or row must return JSX on every return path.
solid-yield check: 3 files, 1 errors
transform App.tsx:13 [SUGAR_RETURN] [SUGAR_RETURN] A component or row must return JSX on every return path. (<job>/source/App.tsx:13:22)
```

### F-M76: M0113 inline-component at reviewer-m03b_throw_in_memo/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline722(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>{if(count()>100)throw'too big';return count()*2;});return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline722 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M77: M0114 non-core-cache at reviewer-m03b_throw_in_memo/App.tsx:8

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:6:10 error TS95000: [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole.
solid-yield check: 3 files, 1 errors
transform App.tsx:16 [SUGAR_CALLBACK] [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (<job>/source/App.tsx:16:31)
```

### F-M78: M0121 inline-component at reviewer-m03b_throw_in_memo/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m03b_throw_in_memo/App.tsx
+++ reviewer-m03b_throw_in_memo/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline845(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline845 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M79: M0122 never-provided-context at reviewer-m03b_throw_in_memo/App.tsx:13

Expected at this exact line: NO_PROVIDER.

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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:15 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M80: M0123 non-core-cache at reviewer-m03b_throw_in_memo/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:16:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 3 errors
```

### F-M81: M0125 delete-provider at reviewer-m03b_throw_in_memo/App.tsx:24

Expected at this exact line: NO_PROVIDER.

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
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown; may-wait false; requires ThemeCtx; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails unknown; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
```

### F-M82: M0126 delete-errored at reviewer-m03b_throw_in_memo/App.tsx:26

Expected at this exact line: FOREIGN_HANDOFF.

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
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M83: M0127 delete-loading at reviewer-m03b_throw_in_memo/App.tsx:27

Expected at this exact line: PENDING_ROOT.

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
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails unknown; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M84: M0128 remove-await at reviewer-m03b_throw_in_memo/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m03b_throw_in_memo/api.ts
+++ reviewer-m03b_throw_in_memo/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M85: M0131 inline-component at reviewer-m03c_throw_in_handler/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m03c_throw_in_handler/App.tsx
+++ reviewer-m03c_throw_in_handler/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline720(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>{if(count()>100)throw new Error('x');setCount(count()+1);}}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline720 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M86: M0141 inline-component at reviewer-m03c_throw_in_handler/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m03c_throw_in_handler/App.tsx
+++ reviewer-m03c_throw_in_handler/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline843(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline843 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M87: M0142 never-provided-context at reviewer-m03c_throw_in_handler/App.tsx:13

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m03c_throw_in_handler/App.tsx
+++ reviewer-m03c_throw_in_handler/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:15 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M88: M0143 non-core-cache at reviewer-m03c_throw_in_handler/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:16:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 3 errors
```

### F-M89: M0145 delete-provider at reviewer-m03c_throw_in_handler/App.tsx:24

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error; may-wait false; requires ThemeCtx; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails global:Error; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
```

### F-M90: M0146 delete-errored at reviewer-m03c_throw_in_handler/App.tsx:26

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M91: M0147 delete-loading at reviewer-m03c_throw_in_handler/App.tsx:27

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails global:Error; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M92: M0148 remove-await at reviewer-m03c_throw_in_handler/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m03c_throw_in_handler/api.ts
+++ reviewer-m03c_throw_in_handler/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M93: M0151 inline-component at reviewer-m04_async_handler/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline728(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);const save=async()=>{await fetchItems();throw new Error('nope');};return<button onClick={save}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline728 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M94: M0155 remove-await at reviewer-m04_async_handler/App.tsx:9

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => count() * 2);
-  const save = async () => { await fetchItems(); throw new Error('nope'); };
+  const save = async () => { fetchItems(); throw new Error('nope'); };
   return <button onClick={save}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M95: M0156 async-reject at reviewer-m04_async_handler/App.tsx:9

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -6,7 +6,7 @@
 function Counter() {
   const [count, setCount] = createSignal(0);
   const twice = createMemo(() => count() * 2);
-  const save = async () => { await fetchItems(); throw new Error('nope'); };
+  const save = async () => { await fetchItems(); throw new Error("mutant rejection"); throw new Error('nope'); };
   return <button onClick={save}>{count()} / {twice()}</button>;
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M96: M0161 inline-component at reviewer-m04_async_handler/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline851(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline851 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M97: M0162 never-provided-context at reviewer-m04_async_handler/App.tsx:14

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m04_async_handler/App.tsx
+++ reviewer-m04_async_handler/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:16 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M98: M0163 non-core-cache at reviewer-m04_async_handler/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:17:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 3 errors
```

### F-M99: M0165 delete-provider at reviewer-m04_async_handler/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires ThemeCtx; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails global:Error | unknown; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
```

### F-M100: M0166 delete-errored at reviewer-m04_async_handler/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M101: M0167 delete-loading at reviewer-m04_async_handler/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails global:Error | unknown; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M102: M0168 remove-await at reviewer-m04_async_handler/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m04_async_handler/api.ts
+++ reviewer-m04_async_handler/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails global:Error | unknown; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M103: M0171 inline-component at reviewer-m05_swallow/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline727(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline727 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M104: M0178 inline-component at reviewer-m05_swallow/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline850(){const theme=useContext(ThemeCtx);const items=createMemo(async()=>{try{return await fetchItems();}catch{return[];}});return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline850 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M105: M0179 never-provided-context at reviewer-m05_swallow/App.tsx:13

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m05_swallow/App.tsx
+++ reviewer-m05_swallow/App.tsx (mutant)
@@ -10,7 +10,7 @@
 }
 
 function List() {
-  const theme = useContext(ThemeCtx);
+  const theme = useContext(createContext<number>());
   const items = createMemo(async () => { try { return await fetchItems(); } catch { return []; } });
   return (
     <ul class={theme}>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:12 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M106: M0180 non-core-cache at reviewer-m05_swallow/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 3 files, 1 errors
```

### F-M107: M0181 delete-catch at reviewer-m05_swallow/App.tsx:14

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

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

### F-M108: M0182 remove-await at reviewer-m05_swallow/App.tsx:14

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

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

### F-M109: M0184 delete-provider at reviewer-m05_swallow/App.tsx:24

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
```

### F-M110: M0185 delete-errored at reviewer-m05_swallow/App.tsx:26

Expected at this exact line: FOREIGN_HANDOFF.

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

### F-M111: M0186 delete-loading at reviewer-m05_swallow/App.tsx:27

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 1 errors
```

### F-M112: M0187 remove-await at reviewer-m05_swallow/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m05_swallow/api.ts
+++ reviewer-m05_swallow/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 3 files, 0 errors
```

### F-M113: M0190 inline-component at reviewer-m06_memo_writes/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m06_memo_writes/App.tsx
+++ reviewer-m06_memo_writes/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline709(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>{setCount(count()+1);return count()*2;});return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline709 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/App.tsx:22:117 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 4 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M114: M0198 inline-component at reviewer-m06_memo_writes/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m06_memo_writes/App.tsx
+++ reviewer-m06_memo_writes/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline832(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline832 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 3 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M115: M0199 never-provided-context at reviewer-m06_memo_writes/App.tsx:13

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m06_memo_writes/App.tsx
+++ reviewer-m06_memo_writes/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:15 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M116: M0200 non-core-cache at reviewer-m06_memo_writes/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/App.tsx:16:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 4 errors
```

### F-M117: M0202 delete-provider at reviewer-m06_memo_writes/App.tsx:24

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires ThemeCtx; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails any; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
```

### F-M118: M0203 delete-errored at reviewer-m06_memo_writes/App.tsx:26

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
```

### F-M119: M0204 delete-loading at reviewer-m06_memo_writes/App.tsx:27

Expected at this exact line: PENDING_ROOT.

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
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails any; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails any; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 3 errors
```

### F-M120: M0205 remove-await at reviewer-m06_memo_writes/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m06_memo_writes/api.ts
+++ reviewer-m06_memo_writes/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:8:36 error TS2345: [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
```

### F-M121: M0208 inline-component at reviewer-m07_timeout_read/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m07_timeout_read/App.tsx
+++ reviewer-m07_timeout_read/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline720(){const[count,setCount]=createSignal(0);setTimeout(()=>console.log(count()),10);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline720 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
<job>/source/App.tsx:23:33 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 3 errors
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M122: M0216 inline-component at reviewer-m07_timeout_read/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m07_timeout_read/App.tsx
+++ reviewer-m07_timeout_read/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline843(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline843 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 2 errors
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M123: M0217 never-provided-context at reviewer-m07_timeout_read/App.tsx:14

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m07_timeout_read/App.tsx
+++ reviewer-m07_timeout_read/App.tsx (mutant)
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
<job>/source/App.tsx:18:28 error TS95000: [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
solid-yield check: 3 files, 1 errors
transform App.tsx:18 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
```

### F-M124: M0218 non-core-cache at reviewer-m07_timeout_read/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
<job>/source/App.tsx:17:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 4 errors
```

### F-M125: M0220 delete-provider at reviewer-m07_timeout_read/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
```

### F-M126: M0221 delete-errored at reviewer-m07_timeout_read/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
```

### F-M127: M0222 delete-loading at reviewer-m07_timeout_read/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M128: M0223 remove-await at reviewer-m07_timeout_read/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m07_timeout_read/api.ts
+++ reviewer-m07_timeout_read/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:6:10 error TS2345: [generated] [NATIVE_CALLBACK_FAILURE] This foreign callback can fail; handle failures inside the callback.
solid-yield check: 3 files, 1 errors
```

### F-M129: M0226 inline-component at reviewer-m08_portal/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m08_portal/App.tsx
+++ reviewer-m08_portal/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline721(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Portal><Counter /></Portal>
+      <Portal><MutantInline721 /></Portal>
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M130: M0233 inline-component at reviewer-m08_portal/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m08_portal/App.tsx
+++ reviewer-m08_portal/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline853(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Portal><Counter /></Portal>
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline853 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M131: M0234 never-provided-context at reviewer-m08_portal/App.tsx:14

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m08_portal/App.tsx
+++ reviewer-m08_portal/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:13 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M132: M0235 non-core-cache at reviewer-m08_portal/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<job>/source/App.tsx:17:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
```

### F-M133: M0237 delete-provider at reviewer-m08_portal/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
```

### F-M134: M0238 delete-errored at reviewer-m08_portal/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
```

### F-M135: M0239 delete-loading at reviewer-m08_portal/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 1 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
```

### F-M136: M0240 remove-await at reviewer-m08_portal/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m08_portal/api.ts
+++ reviewer-m08_portal/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
<job>/source/App.tsx:26:7 warning TS95001: [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
solid-yield check: 3 files, 0 errors
transform App.tsx:26 [NATIVE_FOREIGN_BOUNDARY] Portal (Portal from @solidjs/web) stays Solid at this JSX boundary (provenance C; foreign failures unknown). Handle failures at the boundary. To bring it inside, use a core API or select its source with a checked contract.
```

### F-M137: M0243 inline-component at reviewer-m09_destructure/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline724(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline724 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List title="x" />
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M138: M0244 non-core-cache at reviewer-m09_destructure/App.tsx:8

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:14:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:14 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M139: M0245 memo-write at reviewer-m09_destructure/App.tsx:8

Expected at this exact line: WRITE_IN_REACTIVE, solid-yield/no-unyielded-write.

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
<job>/source/App.tsx:14:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:14 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M140: M0246 setup-read at reviewer-m09_destructure/App.tsx:9

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M141: M0247 setup-read at reviewer-m09_destructure/App.tsx:9

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M142: M0248 setup-read at reviewer-m09_destructure/App.tsx:9

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M143: M0249 setup-read at reviewer-m09_destructure/App.tsx:9

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:12:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:12 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M144: M0250 inline-component at reviewer-m09_destructure/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m09_destructure/App.tsx
+++ reviewer-m09_destructure/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline847({title}:{title:string;}){console.log(title);const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List title="x" />
+          <MutantInline847 title="x" />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M145: M0251 never-provided-context at reviewer-m09_destructure/App.tsx:14

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M146: M0252 non-core-cache at reviewer-m09_destructure/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M147: M0253 setup-read at reviewer-m09_destructure/App.tsx:16

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M148: M0254 delete-provider at reviewer-m09_destructure/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M149: M0255 delete-errored at reviewer-m09_destructure/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M150: M0256 delete-loading at reviewer-m09_destructure/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M151: M0257 remove-await at reviewer-m09_destructure/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m09_destructure/api.ts
+++ reviewer-m09_destructure/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:11:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 3 files, 1 errors
transform App.tsx:11 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M152: M0260 inline-component at reviewer-m10_conditional/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m10_conditional/App.tsx
+++ reviewer-m10_conditional/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline723(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()>2?items2():0);const items2=()=>count();return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline723 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M153: M0267 inline-component at reviewer-m10_conditional/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m10_conditional/App.tsx
+++ reviewer-m10_conditional/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline846(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline846 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M154: M0268 never-provided-context at reviewer-m10_conditional/App.tsx:14

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m10_conditional/App.tsx
+++ reviewer-m10_conditional/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:13 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M155: M0269 non-core-cache at reviewer-m10_conditional/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:17:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
```

### F-M156: M0271 delete-provider at reviewer-m10_conditional/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
```

### F-M157: M0272 delete-errored at reviewer-m10_conditional/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M158: M0273 delete-loading at reviewer-m10_conditional/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 1 errors
```

### F-M159: M0274 remove-await at reviewer-m10_conditional/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m10_conditional/api.ts
+++ reviewer-m10_conditional/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"passed"}
solid-yield check: 3 files, 0 errors
```

### F-M160: M0277 inline-component at reviewer-m11_nested_comp/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m11_nested_comp/App.tsx
+++ reviewer-m11_nested_comp/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline714(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);const Inner=()=><i>{count()}</i>;return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline714 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M161: M0285 inline-component at reviewer-m11_nested_comp/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m11_nested_comp/App.tsx
+++ reviewer-m11_nested_comp/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline837(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline837 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:23:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
lint App.tsx:23 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M162: M0286 never-provided-context at reviewer-m11_nested_comp/App.tsx:14

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-m11_nested_comp/App.tsx
+++ reviewer-m11_nested_comp/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:13 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M163: M0287 non-core-cache at reviewer-m11_nested_comp/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:17:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:18:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M164: M0289 delete-provider at reviewer-m11_nested_comp/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M165: M0290 delete-errored at reviewer-m11_nested_comp/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M166: M0291 delete-loading at reviewer-m11_nested_comp/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 1 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M167: M0292 remove-await at reviewer-m11_nested_comp/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m11_nested_comp/api.ts
+++ reviewer-m11_nested_comp/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 3 files, 0 errors
lint App.tsx:9 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M168: M0295 inline-component at reviewer-m12_effect_arity/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -20,10 +20,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline737(){const[count,setCount]=createSignal(0);createEffect(()=>{console.log(count());});const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline737 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
<job>/source/App.tsx:23:89 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 2 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
transform App.tsx:23 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M169: M0297 non-core-cache at reviewer-m12_effect_arity/App.tsx:9

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M170: M0298 memo-write at reviewer-m12_effect_arity/App.tsx:9

Expected at this exact line: WRITE_IN_REACTIVE, solid-yield/no-unyielded-write.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M171: M0299 setup-read at reviewer-m12_effect_arity/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M172: M0300 setup-read at reviewer-m12_effect_arity/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M173: M0301 setup-read at reviewer-m12_effect_arity/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M174: M0302 setup-read at reviewer-m12_effect_arity/App.tsx:10

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M175: M0303 inline-component at reviewer-m12_effect_arity/App.tsx:23

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-m12_effect_arity/App.tsx
+++ reviewer-m12_effect_arity/App.tsx (mutant)
@@ -20,13 +20,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline860(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline860 />
         </Loading>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M176: M0304 never-provided-context at reviewer-m12_effect_arity/App.tsx:14

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M177: M0305 non-core-cache at reviewer-m12_effect_arity/App.tsx:15

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M178: M0306 setup-read at reviewer-m12_effect_arity/App.tsx:16

Expected at this exact line: READ_IN_SETUP, solid-yield/no-read-in-setup.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M179: M0307 delete-provider at reviewer-m12_effect_arity/App.tsx:25

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M180: M0308 delete-errored at reviewer-m12_effect_arity/App.tsx:27

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M181: M0309 delete-loading at reviewer-m12_effect_arity/App.tsx:28

Expected at this exact line: PENDING_ROOT.

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
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M182: M0310 remove-await at reviewer-m12_effect_arity/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-m12_effect_arity/api.ts
+++ reviewer-m12_effect_arity/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:8:3 error TS95000: [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
solid-yield check: 3 files, 1 errors
transform App.tsx:8 [NATIVE_EFFECT_PHASES] createEffect needs a tracked compute and an untracked effect phase.
```

### F-M183: M0313 inline-component at reviewer-s2a_noloading/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-s2a_noloading/App.tsx
+++ reviewer-s2a_noloading/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline674(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline674 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <>
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M184: M0320 inline-component at reviewer-s2a_noloading/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-s2a_noloading/App.tsx
+++ reviewer-s2a_noloading/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline770(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <>
-          <List />
+          <MutantInline770 />
         </>
       </Errored>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M185: M0321 never-provided-context at reviewer-s2a_noloading/App.tsx:13

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-s2a_noloading/App.tsx
+++ reviewer-s2a_noloading/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:12 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M186: M0322 non-core-cache at reviewer-s2a_noloading/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:16:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
```

### F-M187: M0324 delete-provider at reviewer-s2a_noloading/App.tsx:24

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending true; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires ThemeCtx; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M188: M0325 delete-errored at reviewer-s2a_noloading/App.tsx:26

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails unknown | global:Error; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M189: M0326 remove-await at reviewer-s2a_noloading/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-s2a_noloading/api.ts
+++ reviewer-s2a_noloading/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 1 errors
```

### F-M190: M0329 inline-component at reviewer-s2b_noprovider/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-s2b_noprovider/App.tsx
+++ reviewer-s2b_noprovider/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline653(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <>
-      <Counter />
+      <MutantInline653 />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2345: [generated] [CREATE_OUTSIDE_SETUP] Create reactive state in component setup, not in a JSX hole.
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails any; may-wait true; requires any; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails any; may-wait true; requires any; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 4 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M191: M0336 inline-component at reviewer-s2b_noprovider/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-s2b_noprovider/App.tsx
+++ reviewer-s2b_noprovider/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline776(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <>
       <Counter />
       <Errored fallback={err => <p>failed: {String(err)}</p>}>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline776 />
         </Loading>
       </Errored>
     </>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M192: M0337 never-provided-context at reviewer-s2b_noprovider/App.tsx:13

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-s2b_noprovider/App.tsx
+++ reviewer-s2b_noprovider/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:12 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M193: M0338 non-core-cache at reviewer-s2b_noprovider/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:16:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires any; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 3 errors
```

### F-M194: M0340 delete-errored at reviewer-s2b_noprovider/App.tsx:26

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires ThemeCtx; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails unknown | global:Error; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
```

### F-M195: M0341 delete-loading at reviewer-s2b_noprovider/App.tsx:27

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS2345: [NO_PROVIDER] Component App: pending true; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires ThemeCtx; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M196: M0342 remove-await at reviewer-s2b_noprovider/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-s2b_noprovider/api.ts
+++ reviewer-s2b_noprovider/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 1 errors
```

### F-M197: M0345 inline-component at reviewer-s2c_noerrored/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-s2c_noerrored/App.tsx
+++ reviewer-s2c_noerrored/App.tsx (mutant)
@@ -19,10 +19,10 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline674(){const[count,setCount]=createSignal(0);const twice=createMemo(()=>count()*2);return<button onClick={()=>setCount(count()+1)}>{count()} / {twice()}</button>;}
   return (
     <ThemeCtx value="dark">
-      <Counter />
+      <MutantInline674 />
       <>
         <Loading fallback="loading…">
           <List />
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M198: M0352 inline-component at reviewer-s2c_noerrored/App.tsx:22

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- reviewer-s2c_noerrored/App.tsx
+++ reviewer-s2c_noerrored/App.tsx (mutant)
@@ -19,13 +19,13 @@
   );
 }
 
-export function App() {
+export function App() {function MutantInline743(){const theme=useContext(ThemeCtx);const items=createMemo(()=>fetchItems());return<ul class={theme}> <For each={items()}>{item=><li>{item.name}</li>}</For> </ul>;}
   return (
     <ThemeCtx value="dark">
       <Counter />
       <>
         <Loading fallback="loading…">
-          <List />
+          <MutantInline743 />
         </Loading>
       </>
     </ThemeCtx>
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:22:17 error TS2554: [generated] Expected 0 arguments, but got 1.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 2 errors
lint App.tsx:22 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M199: M0353 never-provided-context at reviewer-s2c_noerrored/App.tsx:13

Expected at this exact line: NO_PROVIDER.

```diff
--- reviewer-s2c_noerrored/App.tsx
+++ reviewer-s2c_noerrored/App.tsx (mutant)
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
Stages: {"transform":"refused","cli":"crashed","lint":"blocked-by-transform"}
transform App.tsx:12 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
CLI crash: Error: Debug Failure. False expression.
    at computePositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:11703:11)
    at SourceFileObject.getPositionOfLineAndCharacter (<root>/node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js:153000:12)
    at Object.refresh (<root>/packages/ts-plugin-yield/src/service.cjs:166:18)
    at check (<root>/packages/ts-plugin-yield/src/cli.cjs:31:27)
    at file://<root>/scripts/mutation/worker.mjs:99:16
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

### F-M200: M0354 non-core-cache at reviewer-s2c_noerrored/App.tsx:14

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:16:5 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:46 error TS2339: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails any; may-wait false; requires any; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 3 errors
```

### F-M201: M0356 delete-provider at reviewer-s2c_noerrored/App.tsx:24

Expected at this exact line: NO_PROVIDER.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires ThemeCtx; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails unknown | global:Error; may-wait false; requires ThemeCtx; The root requires a context; provide it above the component that reads it.
solid-yield check: 3 files, 2 errors
```

### F-M202: M0357 delete-loading at reviewer-s2c_noerrored/App.tsx:27

Expected at this exact line: PENDING_ROOT.

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
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending true; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
<job>/source/index.tsx:3:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails unknown | global:Error; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 3 files, 2 errors
```

### F-M203: M0358 remove-await at reviewer-s2c_noerrored/api.ts:3

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- reviewer-s2c_noerrored/api.ts
+++ reviewer-s2c_noerrored/api.ts (mutant)
@@ -1,6 +1,6 @@
 export type Item = { id: number; name: string };
 export async function fetchItems(): Promise<Item[]> {
-  await new Promise(r => setTimeout(r, 50));
+  new Promise(r => setTimeout(r, 50));
   if (Math.random() < 0.0) throw new Error("boom");
   return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/index.tsx:3:15 error TS2345: [FOREIGN_HANDOFF] Component App: pending false; fails unknown | global:Error; may-wait false; requires none; not handled — wrap in Errored or handle with attempt/catch
solid-yield check: 3 files, 1 errors
```

### F-M204: M0361 inline-component at review-slots-tag/App.tsx:4

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- review-slots-tag/App.tsx
+++ review-slots-tag/App.tsx (mutant)
@@ -1,6 +1,6 @@
 function Child() {
   return <p />;
 }
-export function Parent() {
-  return <Child />;
+export function Parent() {function MutantInline73(){return<p/>;}
+  return <MutantInline73 />;
 }
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:4:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 1 files, 1 errors
lint App.tsx:4 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M205: M0363 non-core-cache at review-slots-pending-root/App.tsx:4

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:3:10 error TS2345: [generated] [WRITE_IN_REACTIVE] A reactive computation cannot write; move this write to an event or effect phase.
<job>/source/App.tsx:7:8 error TS1360: [PENDING_ROOT] Component App: pending true; fails any; may-wait true; requires any; The root may be pending; wrap the pending part in Loading.
solid-yield check: 1 files, 2 errors
```

### F-M206: M0365 destructure-props at review-slots-colored-prop/App.tsx:2

Expected at this exact line: NATIVE_PROPS.

```diff
--- review-slots-colored-prop/App.tsx
+++ review-slots-colored-prop/App.tsx (mutant)
@@ -1,8 +1,8 @@
 import { createSignal, createMemo, createEffect, For, Show, Loading, createContext, useContext } from "solid-js";
-function Child(p: {
+function Child({ n: __mutantProp129, ...p }: {
   n: number;
 }) {
-  return <p>{p.n}</p>;
+  return <p>{__mutantProp129}</p>;
 }
 export function App() {
   const n = createMemo(async () => 1);
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:4:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 1 files, 1 errors
transform App.tsx:4 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M207: M0366 inline-component at review-slots-colored-prop/App.tsx:7

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- review-slots-colored-prop/App.tsx
+++ review-slots-colored-prop/App.tsx (mutant)
@@ -4,7 +4,7 @@
 }) {
   return <p>{p.n}</p>;
 }
-export function App() {
+export function App() {function MutantInline249(p:{n:number;}){return<p>{p.n}</p>;}
   const n = createMemo(async () => 1);
-  return <Child n={n()} />;
+  return <MutantInline249 n={n()} />;
 }
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"passed","lint":"diagnostics"}
solid-yield check: 1 files, 0 errors
lint App.tsx:7 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
lint App.tsx:7 [solid-yield/no-read-in-prop] read in a prop: pass the source (`n: src`), or a hole (`n: function* () { return …; }`) the component reads (D-065).
```

### F-M208: M0367 non-core-cache at review-slots-colored-prop/App.tsx:8

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:9:17 error TS2322: [SETTLED_PROP] This prop is settled; pass a settled value or declare a pending source contract.
solid-yield check: 1 files, 1 errors
```

### F-M209: M0371 inline-component at review-slots-context/App.tsx:7

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- review-slots-context/App.tsx
+++ review-slots-context/App.tsx (mutant)
@@ -4,6 +4,6 @@
   const n = useContext(C);
   return <p>{n}</p>;
 }
-export function App() {
-  return <C value={1}><Child /></C>;
+export function App() {function MutantInline271(){const n=useContext(C);return<p>{n}</p>;}
+  return <C value={1}><MutantInline271 /></C>;
 }
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:7:17 error TS2554: [generated] Expected 0 arguments, but got 1.
solid-yield check: 1 files, 1 errors
lint App.tsx:7 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
```

### F-M210: M0372 never-provided-context at review-slots-context/App.tsx:4

Expected at this exact line: NO_PROVIDER.

```diff
--- review-slots-context/App.tsx
+++ review-slots-context/App.tsx (mutant)
@@ -1,7 +1,7 @@
 import { createSignal, createMemo, createEffect, For, Show, Loading, createContext, useContext } from "solid-js";
 const C = createContext<number>();
 export function Child() {
-  const n = useContext(C);
+  const n = useContext(createContext<number>());
   return <p>{n}</p>;
 }
 export function App() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:4:24 error TS95000: [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
solid-yield check: 1 files, 1 errors
transform App.tsx:4 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
```

### F-M211: M0373 delete-provider at review-slots-context/App.tsx:8

Expected at this exact line: NO_PROVIDER.

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

### F-M212: M0374 delete-loading at review-slots-lazy-child/App.tsx:3

Expected at this exact line: PENDING_ROOT.

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

### F-M213: M0376 delete-catch at review-slots-catch/App.tsx:5

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

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

### F-M214: M0377 non-core-cache at review-slots-memo-write/App.tsx:4

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

```diff
--- review-slots-memo-write/App.tsx
+++ review-slots-memo-write/App.tsx (mutant)
@@ -1,7 +1,7 @@
 import { createSignal, createMemo, createEffect, For, Show, Loading, createContext, useContext } from "solid-js";
 export function Counter() {
   const [count, set] = createSignal(0);
-  const n = createMemo(() => {
+  const n = ((fn: () => any) => { let cached: any; return () => cached ??= fn(); })(() => {
     set(1);
     return count();
   });
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:5:5 error TS95000: [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole.
solid-yield check: 1 files, 1 errors
transform App.tsx:11 [SUGAR_CALLBACK] [SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (<job>/source/App.tsx:11:5)
```

### F-M215: M0382 never-provided-context at review-slots-missing-context/App.tsx:5

Expected at this exact line: NO_PROVIDER.

```diff
--- review-slots-missing-context/App.tsx
+++ review-slots-missing-context/App.tsx (mutant)
@@ -2,7 +2,7 @@
 import { render } from '@solidjs/web';
 const C = createContext<number>();
 function App() {
-  const n = useContext(C);
+  const n = useContext(createContext<number>());
   return <p>{n}</p>;
 }
 render(App, document.body);
\ No newline at end of file
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:5:24 error TS95000: [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
solid-yield check: 1 files, 1 errors
transform App.tsx:5 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
```

### F-M216: M0387 destructure-props at operator-seeds/App.tsx:7

Expected at this exact line: NATIVE_PROPS.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -4,9 +4,9 @@
 const Identity = createContext<number>();
 class Problem extends Error {}
 function fail() { throw new Problem('failure'); }
-function Child(props: { value: number }) {
+function Child({ value: __mutantProp328, ...props }: { value: number }) {
   const identity = useContext(Identity);
-  return <p>{props.value}{identity}</p>;
+  return <p>{__mutantProp328}{identity}</p>;
 }
 function App() {
   const [count, setCount] = createSignal(1);
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:14:1 error TS95000: [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
solid-yield check: 2 files, 1 errors
transform App.tsx:14 [NATIVE_PROPS] Destructured component parameters need a checked snapshot-versus-path mapping.
```

### F-M217: M0388 inline-component at operator-seeds/App.tsx:11

Expected at this exact line: NATIVE_COMPONENT, SUGAR_CALLBACK, SUGAR_RETURN, FOREIGN_HANDOFF.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -8,7 +8,7 @@
   const identity = useContext(Identity);
   return <p>{props.value}{identity}</p>;
 }
-function App() {
+function App() {function MutantInline1088(props:{value:number;}){const identity=useContext(Identity);return<p>{props.value}{identity}</p>;}
   const [count, setCount] = createSignal(1);
   const value = createMemo(async () => {
     try { return await readServer(); } catch (e) { throw e; }
@@ -23,7 +23,7 @@
   return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
     <button onClick={async () => { await save(); }}>{twice()}</button>
     <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
-    <Child value={count()} /><p>{value()}</p>
+    <MutantInline1088 value={count()} /><p>{value()}</p>
   </Loading></Errored></Identity>;
 }
 render(() => <App />, document.body);
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"diagnostics"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
lint App.tsx:11 [solid-yield/jsx-only-in-view] JSX in a setup: elements are built by the view it returns (`return view(function* () { return <…/>; })`).
lint App.tsx:11 [solid-yield/no-read-in-prop] read in a prop: pass the source (`value: src`), or a hole (`value: function* () { return …; }`) the component reads (D-065).
```

### F-M218: M0389 never-provided-context at operator-seeds/App.tsx:8

Expected at this exact line: NO_PROVIDER.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -5,7 +5,7 @@
 class Problem extends Error {}
 function fail() { throw new Problem('failure'); }
 function Child(props: { value: number }) {
-  const identity = useContext(Identity);
+  const identity = useContext(createContext<number>());
   return <p>{props.value}{identity}</p>;
 }
 function App() {
```

Checker said instead:

```text
Stages: {"transform":"refused","cli":"diagnostics","lint":"blocked-by-transform"}
<job>/source/App.tsx:17:31 error TS95000: [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
solid-yield check: 2 files, 1 errors
transform App.tsx:17 [NATIVE_CONTEXT] A native context needs a named declaration for its generated requirement identity.
```

### F-M219: M0390 non-core-cache at operator-seeds/App.tsx:13

Expected at this exact line: SUGAR_CALLBACK, NATIVE_FOREIGN_BOUNDARY, FOREIGN_HANDOFF, READ_IN_SETUP.

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
<job>/source/App.tsx:23:55 error TS2769: [JSX_IN_SETUP] Build this JSX in the returned view, not in setup.
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 2 errors
```

### F-M220: M0392 delete-catch at operator-seeds/App.tsx:14

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -11,7 +11,7 @@
 function App() {
   const [count, setCount] = createSignal(1);
   const value = createMemo(async () => {
-    try { return await readServer(); } catch (e) { throw e; }
+    { return await readServer(); }
   });
   const twice = createMemo(() => count() * 2);
   createEffect(() => count(), n => setCount(n));
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M221: M0393 remove-await at operator-seeds/App.tsx:14

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

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
   createEffect(() => count(), n => setCount(n));
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M222: M0400 remove-await at operator-seeds/App.tsx:20

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -17,7 +17,7 @@
   createEffect(() => count(), n => setCount(n));
   setTimeout(() => setCount(2), 1);
   const save = async () => {
-    await Promise.resolve();
+    Promise.resolve();
     setCount(count() + 1);
   };
   return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M223: M0401 async-reject at operator-seeds/App.tsx:20

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -17,7 +17,7 @@
   createEffect(() => count(), n => setCount(n));
   setTimeout(() => setCount(2), 1);
   const save = async () => {
-    await Promise.resolve();
+    await Promise.resolve(); throw new Error("mutant rejection");
     setCount(count() + 1);
   };
   return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M224: M0402 delete-provider at operator-seeds/App.tsx:23

Expected at this exact line: NO_PROVIDER.

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
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/App.tsx:29:15 error TS1360: [NO_PROVIDER] Component App: pending false; fails none; may-wait false; requires Identity; The root requires a context; provide it above the component that reads it.
solid-yield check: 2 files, 2 errors
```

### F-M225: M0403 delete-errored at operator-seeds/App.tsx:23

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M226: M0404 delete-loading at operator-seeds/App.tsx:23

Expected at this exact line: PENDING_ROOT.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -20,10 +20,10 @@
     await Promise.resolve();
     setCount(count() + 1);
   };
-  return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
+  return <Identity value={1}><Errored fallback={() => <p>failed</p>}><>
     <button onClick={async () => { await save(); }}>{twice()}</button>
     <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
     <Child value={count()} /><p>{value()}</p>
-  </Loading></Errored></Identity>;
+  </></Errored></Identity>;
 }
 render(() => <App />, document.body);
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
<job>/source/App.tsx:29:15 error TS1360: [PENDING_ROOT] Component App: pending true; fails none; may-wait false; requires none; The root may be pending; wrap the pending part in Loading.
solid-yield check: 2 files, 2 errors
```

### F-M227: M0405 remove-await at operator-seeds/App.tsx:24

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -21,7 +21,7 @@
     setCount(count() + 1);
   };
   return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
-    <button onClick={async () => { await save(); }}>{twice()}</button>
+    <button onClick={async () => { save(); }}>{twice()}</button>
     <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
     <Child value={count()} /><p>{value()}</p>
   </Loading></Errored></Identity>;
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M228: M0406 async-reject at operator-seeds/App.tsx:24

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -21,7 +21,7 @@
     setCount(count() + 1);
   };
   return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
-    <button onClick={async () => { await save(); }}>{twice()}</button>
+    <button onClick={async () => { await save(); throw new Error("mutant rejection"); }}>{twice()}</button>
     <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
     <Child value={count()} /><p>{value()}</p>
   </Loading></Errored></Identity>;
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M229: M0408 delete-catch at operator-seeds/App.tsx:25

Expected at this exact line: FOREIGN_HANDOFF, NATIVE_CALLBACK_FAILURE.

```diff
--- operator-seeds/App.tsx
+++ operator-seeds/App.tsx (mutant)
@@ -22,7 +22,7 @@
   };
   return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
     <button onClick={async () => { await save(); }}>{twice()}</button>
-    <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
+    <button onClick={() => { { fail(); } }}>Fail</button>
     <Child value={count()} /><p>{value()}</p>
   </Loading></Errored></Identity>;
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M230: M0413 remove-await at operator-seeds/server.ts:4

Expected at this exact line: TS2322, TS2345, GENERATED_TYPE, SETTLED_PROP.

```diff
--- operator-seeds/server.ts
+++ operator-seeds/server.ts (mutant)
@@ -1,7 +1,7 @@
 class ServerProblem extends Error {}
 export async function readServer() {
   'use server';
-  await Promise.resolve();
+  Promise.resolve();
   if (false) throw new ServerProblem('server');
   return 1;
 }
```

Checker said instead:

```text
Stages: {"transform":"completed","cli":"diagnostics","lint":"passed"}
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

### F-M231: M0416 server-new-class at operator-seeds/server.ts:5

Expected at this exact line: FOREIGN_HANDOFF.

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
<job>/source/App.tsx:17:31 error TS2345: [GENERATED_TYPE] Generated code does not satisfy the library contract. Check the operation and its enclosing host.
solid-yield check: 2 files, 1 errors
```

## Findings list

- F-M1–F-M231: 231 exact-line survivors, each with its full diff and actual diagnostics above.
- F-C1–F-C20: the top checker survivors above; remaining survivors stay in the raw Stryker reports.
- F-MAP: 17 mutant CLI crashes; the current position/error mapping can throw instead of returning diagnostics. IDs: M0031, M0034, M0052, M0069, M0086, M0104, M0122, M0142, M0162, M0179, M0199, M0234, M0268, M0286, M0321, M0337, M0353.
- F-SCOPE: Vite native/sugar/transform/positions and compiler inference still need full checker-mutant runs. The full command-runner configuration is checked in.
- F-COVERAGE: The Vitest adapter does not collect CLI/tsserver subprocess coverage. NoCoverage there may be a runner limit, not an absent test. The full command runner avoids coverage-based selection.
- F-TIMEOUT: Stryker includes timeouts as detected. They need follow-up to distinguish loops from slow runs under contention.
- F-HISTORY: Seven historical review identities remain unavailable; 27/34 reconstructed slots are covered.
- F-BOUNDARY-LOCALITY: Removing wrappers/providers can report valid boundary errors at the root rather than at the edit. Those are survivors under the requested strict locality rule.

## Build and gate verification

Each local commit was preceded by pnpm build and a full gate against documentation/yield-gate-baseline.json. Successful full runs:
- 65 pass / 0 fail / 0 skip in 699s; --jobs 1; head d88e31c.
- 65 pass / 0 fail / 0 skip in 521s; --jobs 2; head 67dd7d7.
- 65 pass / 0 fail / 0 skip in 520s; --jobs 2; head 09c800a.

The first concurrent gate attempt had one unchanged Sierpinski animation-frame test exceed its 5-second timeout; the complete reruns passed. No test timeout, existing gate entry, or checker source was changed. Only the mutation step and initial score/site floors were added to the baseline. Literal unified diffs retain blank context-line prefixes; those intentional spaces can trigger the default Git whitespace check.
