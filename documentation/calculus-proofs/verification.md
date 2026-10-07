# Verification record

Source audited: `1da4d8218e5cebadba3387a43542b61c310607fb`.
All committed additions are under `documentation/calculus-proofs/`. No tracked library,
package test, lockfile, generated distribution, or original calculus text was
changed. Commits are local on `proto/calculus-proofs`; nothing was pushed.

## Proof assistant

Lean **4.24.0**, via elan in `/private/tmp/elan`; Lake project with only `Std`,
no third-party proof packages. Installation ran in the foreground within the
20-minute tooling budget, with `ELAN_HOME` explicitly set and `--no-modify-path`.
HOME was not changed. Lean/Lake, Agda and Coq were initially absent from PATH.

```sh
cd documentation/calculus-proofs/lean
ELAN_HOME=/private/tmp/elan /private/tmp/elan/bin/lake build
```

**PASS.** The latest proof addition (`foreign_pending`) triggered an actual Lean
compile, not just a cache replay. The source has no `sorry`, project `axiom`,
unsafe proof bypass, or `native_decide`. The printed dependencies of preservation,
owner/root safety and foreign safety contain only Lean's standard `propext`,
`Classical.choice` and `Quot.sound` (plain preservation uses only `propext`).
Solid and TypeScript are not encoded as trusted Lean axioms: the abstract
primitive interfaces and the missing runtime simulation are stated separately.

## Executable counterexamples

Tools: Node **24.18.0**, TypeScript **6.0.3**, Vitest **4.1.11**, Solid
**2.0.0-rc.13**. Repository package manager: pnpm **11.1.1**.
Commands run from the worktree root:

| Check                                                                                                                      | Result                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node node_modules/typescript/bin/tsc -p documentation/calculus-proofs/probes/tsconfig.json`                               | PASS; strict settings with both JSX factory settings; no suppressed diagnostics.                                                                                             |
| `node documentation/calculus-proofs/probes/lint.mjs`                                                                       | PASS; zero diagnostics from C3's eight named rules. Full recommended lint has exactly one expected diagnostic, read-before-attempt for F11; the other witness code has none. |
| `node node_modules/vitest/vitest.mjs run --config documentation/calculus-proofs/probes/vite.config.mjs`                    | PASS, 11/11.                                                                                                                                                                 |
| `PROOF_PRODUCTION=1 node node_modules/vitest/vitest.mjs run --config documentation/calculus-proofs/probes/vite.config.mjs` | PASS, 11/11.                                                                                                                                                                 |

The runtime tests **assert the defects**, so these passes confirm the findings;
they do not certify safety. Nine root checks reproduce thrown errors, one event
check reproduces rejection after attempted absorption of a frozen error, and
one foreign-pending check pins blank output with no Loading in the constructed
tree. Both modes use Solid's development client; only the yield library's
`__DEV__` flag changes. These probes make no SSR, minified-build, or disposed-owner
claim. Existing SSR/conformance tests are covered by the separate repository gate.

F01 is a syntactic reachability counterexample, not an exhaustive runtime test.
F11's current runtime refusal and F12/F14's corrected/intended behavior also use
the existing tests named in the obligation map. F15 identifies missing assumptions;
no observed once/seed/disposal regression is claimed. No generated-program or
fast-check suite was added.

## Repository checks

`pnpm build`: **PASS** before the gate. The gate also checks distribution freshness.

```sh
node scripts/yield-gate.mjs \
  --baseline documentation/yield-gate-baseline.json \
  --json /private/tmp/calculus-proofs-gate.json
```

**GREEN: 37 passed / 0 failed / 0 skipped, in 838 seconds.** Baseline
comparison: zero new failures, 37 unchanged passing steps. The full run includes
twin tests/typechecks/lint, SSR and hydration smoke tests, package tests and
exports, the conformance suite, Prettier, and oxlint.

An earlier gate process was externally interrupted; its partial output is not
counted. The record above refers to the complete restarted run. pnpm startup
was unusually slow (about 72 seconds per invocation), without corresponding
failures; this explains the gate duration rather than a reduced test selection.

`git diff --check`: **PASS**. The obligation-map integrity check found O1–O52
exactly once, with **12 M / 26 P / 14 U** primary classifications. Local Markdown
links were checked. Those classifications and all 15 findings are documented,
including explicit counterexamples and the limits of their preconditions.
