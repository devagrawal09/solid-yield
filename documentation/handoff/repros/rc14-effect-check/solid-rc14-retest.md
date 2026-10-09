# Solid rc.14 retest — 2026-10-08

Status: **committed on chore/rc14; two known red steps allowed on this branch only**. Branch base: 4de2d47; this task does not advance main. Nothing was pushed. Installed `solid-js` and
`@solidjs/web` are exactly **2.0.0-rc.14** throughout the workspace.
`@solidjs/signals` follows Solid to rc.14; `@solidjs/compiler`,
`@solidjs/babel-plugin` and `@solidjs/h` remain rc.13. Node v24.18.0,
pnpm 11.1.1, macOS arm64. The install ran in the foreground.

## #3815 / rendering's /profile

The [documented plain-Solid repro](solid-ssr-memo-loop-rc13.md), compiled for
SSR by the unchanged rc.13 compiler, finishes on rc.14: production 111 ms,
development 108 ms, one Page setup, correct Jon markup and serialized user/info,
and the 200 ms timer fires. Development also emits LAZY_ASSET_UNMAPPED because
the repro supplies an empty manifest; the stream still completes.

The server-only array wrapper from 046387b was removed from perform in
d5d96aa23cc775a8d0d32beea1340b0059d11495. Its regression test is retained unchanged and passes: one setup,
less than five info runs, Jon plus both facts. All nine tests in ssr.spec.tsx
pass. All 14 rendering string/stream smoke cases pass, including streamed
/profile (2.36 s, 2,780 characters). Removal commit: d5d96aa23cc775a8d0d32beea1340b0059d11495. The later ruling allows the two known red gate steps on chore/rc14 only.

## F-C14

The [exact check](solid-frames-f-c14-check-rc13.md) **does not converge**.
The microtask-promise reduction reaches the 10,001-pass error in production and
development. It fails through both frames and ordinary streaming (210/182 ms
in the paired production control). The full timer-based frame returns after
30.13 s with only Loading and a complete chunk with bound: time, without a
paragraph or onError call. Ordinary streaming takes 113.58 s, reports the
10,001-pass error and returns an empty string.

The actual F-C14 form — a hoisted async loader and a synchronous derived memo
beneath Loading — renders HELLO without errors through both public renderers
(2 ms each). The failing content-function check remains separate from the
fixed #3815 repro; rc.14 does not establish that they have one fix.

## F-C9 / D-115

All four runs of the withdrawn repro (production/development, safe/unsafe)
still return a synchronous string containing Loading article…, before rejection,
with zero error-fallback calls. The draft stays withdrawn. The full gate's
SSR/hydration smoke checks include D-115's real production serialization case:
the typed kind/message and hydrated not-found fallback pass.

## Gate changes and blocker

The first rc.14 run with the workaround retained is **43/46**. Newly failing
steps: twin:effect-yield:test, pkg:yield:conformance and twins:executed-bytes.
No previously failing step newly passed; the baseline has 46 passes.

The conformance update is limited to runtime changes: its script sandbox now
accepts document.addEventListener; the two async-hydration SSR artifacts gain
rc.14's load/error reveal listeners; the error-routing client golden loses one
repeated typed-error fallback call after resetting a repaired source. The
initial typed error, synchronous error and bound-event fallback checks remain;
plain Solid and the library match the updated trace.

**Effect blocks the upgrade.** With unchanged original/twin source and compiler,
rc.14 loses the error fallback after the retry failure. The original's log says
search vite failed for good: TransientNetwork, but its DOM displays No packages
match “vite”. There is no .error-box and no Try again button. The parity script
therefore stops at network recovers, try again; the executed-byte driver stops
at that same missing button. The twin also loses its initial results stale
panel. These behavior assertions and the authored script are kept unchanged.

An A/B run of the same diagnostic against the retained rc.13 client builds
shows results stale / Searching… after type s and the TransientNetwork
error fallback plus Try again after retries give up. On rc.14 there is no
results/loading/error panel immediately after type s; after retries give up
there is the empty-results panel and no error fallback. The existing Effect
suite was also run with the rc.13 runtime aliases as a control: 13 existing
tests plus the diagnostic pass; one optional runtime-cost test skips.

The final `pnpm build` passes. The full gate is **44/46 RED** in 234 s:
**new failures versus the committed baseline:** `twin:effect-yield:test` and
`twins:executed-bytes`; **new passes versus the baseline:** none;
**unchanged passes:** 44. The initially failing conformance step now passes
after the reviewed runtime-only updates above. SSR/hydration smoke, package
tests, exports, types, lint, formatting, analyzer and proofs all pass.
The later ruling permits these two red steps on chore/rc14 only. The candidate
is committed there; this task does not advance main. No gate step is excluded or marked passing. `git diff --check` passes.

## Effect diagnosis — rc.14 follow-up

**(a) Solid regression.** A standalone plain-Solid client repro under
/private/tmp/rc14-effect-check needs only Errored, an async memo, latest and
a separate isPending render reader; it needs no JSX/compiler, router, Effect,
Show or Loading. rc.13 renders ERROR: Search failed once; rc.14 leaves 0 and
calls the fallback zero times, in production and development. Removing the
isPending reader restores rc.14's fallback. Instrumentation confirms a held
source already in STATUS_ERROR returns its committed [] before verdictValue
reaches its error check. The standalone [issue draft](solid-errored-fallback-rc14.md)
contains the exact source, outputs, changed code and release-note check. Status:
**draft, not filed**.

**The twin also fails.** Its own app.test.tsx error-recovery test, run without
the parity test or original, fails at line 109 because .error-box p is absent
(one test failed; eleven unrelated tests skipped by -t). The prior 44/46 count
includes twin:effect-yield:test among the two red steps; it is not evidence
that the twin passed. latestOf / isPendingOf delegate directly to Solid's
latest / isPending (runtime.ts:449,458), so the library supplies no workaround
for this error-read ordering. Both applications remain unchanged.

## Executed bytes

**No committed byte or gate thresholds were changed.** Eight unaffected twins
were measured separately with --only, --record to temporary files, and the
existing --baseline. All 16 original/twin rows pass their existing limits at
load and every authored step. The table gives byte deltas from the committed
rc.13 baseline; all loads shrink. The client/application/driver source is
unchanged; perform's removed wrapper and the conformance updates affect only
SSR/testing. These observed shifts therefore come from the runtime upgrade.
Effect's complete byte measurement is unavailable until its behavior passes;
no partial measurement is substituted into the baseline.

| Twin | Original load delta | Twin load delta | Original step deltas | Twin step deltas |
| --- | ---: | ---: | --- | --- |
| effect-yield | unavailable | unavailable | authored script stops at missing retry button | same blocked script |
| docs-yield | -75537 | -74658 | -62754 to -843 | -61944 to 357 |
| hackernews-spa-yield | -75362 | -74290 | -56663 to -13677 | -57898 to -19559 |
| rendering-yield | -56792 | -56247 | -57252 to -1117 | -55367 to -10784 |
| room-yield | -94408 | -91168 | -75421 to -843 | -76103 to -843 |
| sierpinski-yield | -72160 | -71055 | -32700 to -843 | -30498 to -843 |
| sierpinski-yield-h | -72160 | -71131 | -32700 to -843 | -30606 to -843 |
| todos-yield | -90025 | -87887 | -73779 to -843 | -74640 to -843 |
| todos-yield-h | -90025 | -87729 | -73779 to -843 | -74848 to -843 |

The allowance stays 2 percent or 1,024 bytes per phase, whichever is larger.
A complete baseline refresh is deferred until Effect can complete the same
script successfully; all existing maxBytes values remain in force.

**Compiler measurements:** C3b/C3c, including the 25.6 KB gzip break-even,
are **rc.13 figures**. They need re-measurement on rc.14 before using them
for current runtime comparisons. They were not re-measured in this task.

**Concurrent main update:** during this diagnosis another worktree merged
examples/dashboard into main at cba2bd0 (main is checked out in sy-dash).
This task preserved that update. chore/rc14 remains based on 4de2d47.

**Before the diagnosis commit:** build passed again; the full gate remained
44/46 RED (172 s), with exactly twin:effect-yield:test and
twins:executed-bytes failing. No other red step is allowed.
