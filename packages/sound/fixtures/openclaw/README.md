# Frozen OpenClaw reductions (rc.17)

Registry: ../openclaw.mjs, group `openclaw`. Origins: ../origins.mjs
OPENCLAW_ORIGINS. Decision: D-131. Runtime checks: ../../test/openclaw-runtime.test.tsx
and ../../results/openclaw-runtime.md. Deferred research: ../../FUTURE.md.

34 programs: 18 clean controls and 16 diagnostic-bearing mutants. Counts by gap:
01: 4; 02: 2; 03: 2; 04: 3; 05: 2; 06: 2; 07: 2; 08: 2;
09: 2; 10: 2; 12: 7; 23 (read scopes only): 4.

All are ordinary strict TypeScript against packages/sound TypeScript and installed
Solid 2.0.0-rc.17 types. No createAsync, assertions to any, or suppressions.
The clone is untrusted read-only data: none of its code, tests or installs ran.

Gap 07 separates fulfilled transport/outcome from a synchronous memo throw, and
puts Loading/Errored in the consuming child. Gap 08 tests lazy prop demand,
not lazy memo scheduling: rc.17 may compute an unused memo eagerly but does not
demand its result through an unused prop. Gap 01 adds translation and count
reads through a returned live service closure; gap 02 forwards compute inputs
to an apply helper. Extra cases are authored controls/mutants, not claims of
new upstream bugs. All static expectations follow D-130 severity.

Mutant parents use openclaw/<id>; only this group has new requirements. Legacy
byte-identical cases and existing expectations remain untouched.
