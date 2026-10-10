# Mutation runs

The plain-Solid generator uses parsed bindings and node spans. Each site gets one
edit; other sites stay unchanged. The catalogue fixes expected codes and explains
edits that are diagnostic-equivalent. Equivalents are still checked. Review
programs that already fail can supply an exact-line kill under the requested
literal rule; those pre-existing matches are flagged in the evidence.

From the repository root, after the normal install and `pnpm build`:

```sh
node --test scripts/mutation/test.mjs
node scripts/mutation/run.mjs
node scripts/mutation/gate.mjs documentation/yield-gate-baseline.json
```

The fresh run uses three isolated child processes. Each runs native lowering,
the CLI's exported `check` implementation, and recommended generated lint.
Generated lint positions use the same composed position tables as the CLI.
Transform refusal blocks lint. CLI crashes are recorded, not counted as kills.
Expected codes must match the exact changed file and line, with no tolerance.

The gate may reuse a local cache only when its content hash matches all selected
sources, checker sources, mutation implementation, library output/declarations,
and workspace lockfile. Checked-in results are evidence, never used as a cache.
The score and every operator's site count must meet the committed baseline.
After interrupting a fresh run, remove `scripts/mutation/.native-generated/jobs`
before restarting, to discard incomplete child projects. Do not run two copies
of the program runner in this worktree at once.

Install isolated checker-mutation tools in the foreground:

```sh
npm install --prefix scripts/mutation/tools --ignore-scripts
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-eslint.config.mjs
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-ts.config.mjs
node scripts/mutation/report.mjs
```

`ts-tests.test.mjs` registers the unchanged node:test suites in Vitest. It clears
Node's test/module cache on each rerun. Assertions are not rewritten. Subprocess
coverage from CLI/tsserver does not return to Vitest; those locations can be
reported as NoCoverage despite executing in a child. This limitation is a finding.
The full command-runner configuration avoids test selection and can run all
requested Vite/native/sugar/position, inference and TypeScript-plugin targets:

```sh
node scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js run scripts/mutation/stryker-core.config.mjs
```

That full scope is deferred in this session. The report records complete runs
of the two smallest checker packages; it does not substitute them for full-scope
evidence. Static mutants and timeouts are retained. No checker fixes or new
checker tests were added to improve scores.

The local pinned package manager can run the required build/gate if the global
pnpm does not start:

```sh
PATH="$PWD/scripts/mutation/tools/node_modules/.bin:$PATH" pnpm build
PATH="$PWD/scripts/mutation/tools/node_modules/.bin:$PATH" node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```
