# Dataflow scale measurements

Run from packages/sound. These scripts only parse the trial copy. They never
import its modules or run its scripts, tests, builds, hooks or plugins. The input
selection is copied from the trial driver: all src .ts/.tsx except declarations,
tests, stories and the listed support directories. No application file is written.

Default input: /Users/devagr/solid-yield-wt/openclaw-trial/app. Set SOUND_APP to
another trial copy with ../compiler-options.json. Dependencies must already exist.
Run only one of the following checker commands at a time.

1. Create scale/evidence if needed.
2. Original closure: /usr/bin/time -l node --expose-gc --max-old-space-size=2048 scale/profile.mjs --unbounded --ts-only > scale/evidence/memory-unbounded.log 2>&1
   (A heap abort is expected; this stops before B.)
3. Attribution: /usr/bin/time -l node --expose-gc --max-old-space-size=2048 scale/profile.mjs > scale/evidence/memory-bounded.log 2>&1
4. Cold: SOUND_SCALE_OUT=scale/evidence/cold node scale/run.mjs
5. Updates: node scale/run.mjs --updates
6. Frozen comparison: node harness/run.mjs
7. Tests: pnpm test --maxWorkers 1
8. Compact evidence: node scale/summarize.mjs

run.mjs starts one capped Node worker under macOS /usr/bin/time. It samples its
process group every 250 ms, records the measuring driver's RSS separately, and
kills the whole worker group at 120 s (900 s for the serial update experiment).
No native checker child is used. JSON is flushed between stages so an abort
cannot be mistaken for an empty successful check. Both sampled group RSS and
OS-reported worker peak RSS are reported; samples can miss brief peaks.

The update experiment changes text only in the checker's memory. It appends a
newline, restores, flips the first Boolean syntax node (or appends an unused
constant), and restores, on three named files. Every semantic run records its
actual full-root invalidation count. Named timings for settings-sidebar-shell
and multi-select are charged analysis jobs in the shared-program full check,
not independent singleton checks.

profile.mjs separates program loading, binding, B's work and releasing B's state.
It counts checked sources, unchecked sources/data, declarations and TypeScript
libraries separately. Heap differences after GC are retained-memory evidence,
not exact allocation totals. The final release keeps the program and diagnostic
records alive; that heap includes TypeScript's on-demand type caches.

Raw outputs are ignored. measurements.json is the compact committed evidence;
RESULTS-scale.md in prototypes/dataflow has the report. Do not compare a completed
partial check with an unbounded full-coverage check without its warning counts.
