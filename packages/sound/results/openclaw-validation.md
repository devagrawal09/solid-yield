# OpenClaw validation (D-131)

- node harness/run.mjs completed on all 143 fixtures and A/B/C/null.
- node harness/openclaw-baseline.mjs measured unchanged checkers.
- pnpm test passed: strict fixture TypeScript, runtime scopes, old fixtures,
  new-group pinned scores, OXC independence and all existing checks.
- 34 new fixtures: 18 controls, 16 diagnostic-bearing mutants.
- No prototype source or previously frozen expectation changed.
- No install was needed; rc.17, TypeScript, compiler, Vitest and jsdom were installed.
- No upstream OpenClaw code, install or test ran.

Final Vitest summary:

```text
Test Files  8 passed (8)
      Tests  205 passed (205)
   Start at  20:27:11
   Duration  49.67s (transform 643ms, setup 0ms, import 1.40s, tests 60.63s, environment 157ms)
```
