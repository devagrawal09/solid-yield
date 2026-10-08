# Soak report

The 2026-10-09 follow-up classification and fixes are recorded at the end of this report. The original measurements below are preserved.

Recorded 2026-10-08T14:55:48.905Z. Node v24.18.0; development/jsdom; exposed GC; report only. Seed 109; 5 real minutes per twin; compare every 5 rounds plus round one.

This report uses the permitted five-minute duration to fit the execution budget. The script defaults to ten minutes and supports sixty. Original and twin each keep one jsdom and one mounted app alive throughout the session. Both receive every action; checkpoints compare their DOM after each step.

The gate lists the soak as a manual **REPORT-ONLY / SKIP** step. A one-minute run of all twins adds at least nine minutes per commit, and process heap results depend on the host. Findings below do not fail the gate. No runtime behavior was fixed in this session.

## Per twin

Slopes are per round, heap in KiB/round. DOM counts include elements, text and comments. Checkpoints lists rounds / individual step comparisons.

| Twin | Seconds | Rounds | Heap slope KiB | Live-root slope | DOM-node slope | Errors | Parity checkpoints | Differences |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| docs-yield | 300.008 | 5577 | 2.003 | 0.000 | -0.000 | 0 | 1116 / 27900 | 0 |
| effect-yield | 300.842 | 1099 | 331.294 | 0.000 | 0.000 | 0 | 220 / 8140 | 0 |
| hackernews-spa-yield | 300.392 | 536 | 15.121 | 0.000 | 0.000 | 0 | 108 / 2052 | 0 |
| rendering-yield | 300.221 | 248 | 9.679 | 0.000 | 0.000 | 0 | 50 / 1350 | 0 |
| room-yield | 300.078 | 1797 | 7.669 | 0.000 | 0.430 | 0 | 360 / 6120 | 0 |
| sierpinski-yield | 307.329 | 54 | 4.524 | 0.000 | 0.000 | 0 | 11 / 121 | 0 |
| sierpinski-yield-h | 314.073 | 26 | 7.688 | 0.000 | 0.000 | 0 | 6 / 66 | 0 |
| todos-yield | 300.085 | 1375 | 12.512 | 0.000 | 0.000 | 0 | 276 / 5244 | 0 |
| todos-yield-h | 300.281 | 1648 | 12.693 | 0.000 | 0.000 | 0 | 330 / 6270 | 0 |

## Other counters

These measure owned library definitions and suspended runtime attempts, not private Solid objects or all promises in Node. The current runtime has no independent event queue; its depth is zero. Active events are measured separately.

| Twin | Boundary slope | Routine slope | Pending-promise slope | Active-event slope | Queue slope | Owned counts after disposal (root / boundary / routine) |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| docs-yield | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 / 0 / 0 |
| effect-yield | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 / 0 / 0 |
| hackernews-spa-yield | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 / 0 / 0 |
| rendering-yield | 0.000 | 0.000 | -0.001 | 0.000 | 0.000 | 0 / 0 / 0 |
| room-yield | 0.000 | 0.061 | 0.000 | 0.000 | 0.000 | 0 / 0 / 0 |
| sierpinski-yield | 0.000 | 0.000 | 0.002 | 0.000 | 0.000 | 0 / 0 / 0 |
| sierpinski-yield-h | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 / 0 / 0 |
| todos-yield | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 / 0 / 0 |
| todos-yield-h | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 / 0 / 0 |

## Method and limits

Least-squares fits discard the first five rounds (or first fifth for small runs). A flag requires ten samples, slope above the allowance, and material fitted growth: heap >4 KiB/round and >max(1 MiB, 5% initial heap); roots/boundaries >0.01/round; routines/pending/events >0.05/round; DOM >0.1/round; queue >0/round. Object metrics also require >3 fitted objects. Allowances filter small cache and changing page-state effects; a flag is a finding to investigate, not proof of a runtime leak.

Heap is process.memoryUsage().heapUsed after forced GC, including the test worker, Vite and jsdom. Snapshots and sample history live only in the separate controller. Dependency-preserving blocks are shuffled; steps inside a block keep the parity script's order. Todos removes remaining rows between rounds; docs revisits home; room alternates routes and retains its app's bounded transcript (200 messages per room). See [the runner](../examples/harness/soak/README.md) for counter definitions and replay details.

This covers client fixtures and development builds. It does not exercise the real network, SSR, hydration, actual browser heap, or future lazy event replay. Cached dynamic imports do not simulate failed chunk downloads. A zero error count includes zero observed [BOUNDARY_DISPOSED] and ChunkError diagnostics; it does not prove those cases cannot occur.

## Findings

### F-K1 — effect-yield

Growth allowance exceeded: heap.

- heap: twin slope 339245.228; original slope 320737.498; fitted twin growth 370795033.864.

Smallest recorded prefix crossing the growth rule: 12 rounds. Replay:

```sh
pnpm soak --only effect-yield --seed 109 --minutes 60 --rounds 12 --out /tmp/F-K1.json
```

Final round's authored step indices/reset actions: `[34,35,10,11,12,13,14,1,2,3,4,5,6,7,8,9,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35]`. The seed reconstructs the preceding round order. This is the smallest **observed** prefix, not a claim that all shorter action sequences were minimized. Heap flags may vary by host.

### F-K2 — hackernews-spa-yield

Growth allowance exceeded: heap.

- heap: twin slope 15483.447; original slope 15235.597; fitted twin growth 8206226.679.

Smallest recorded prefix crossing the growth rule: 160 rounds. Replay:

```sh
pnpm soak --only hackernews-spa-yield --seed 109 --minutes 60 --rounds 160 --out /tmp/F-K2.json
```

Final round's authored step indices/reset actions: `[14,4,14,1,2,14,5,6,7,8,9,10,14,11,12,13,14,3,14]`. The seed reconstructs the preceding round order. This is the smallest **observed** prefix, not a claim that all shorter action sequences were minimized. Heap flags may vary by host.

### F-K3 — rendering-yield

Growth allowance exceeded: heap.

- heap: twin slope 9911.023; original slope 9135.925; fitted twin growth 2398467.638.

Smallest recorded prefix crossing the growth rule: 126 rounds. Replay:

```sh
pnpm soak --only rendering-yield --seed 109 --minutes 60 --rounds 126 --out /tmp/F-K3.json
```

Final round's authored step indices/reset actions: `[23,24,25,26,11,12,13,18,19,20,21,22,14,15,16,17,2,3,4,5,6,7,8,9,10,27,28]`. The seed reconstructs the preceding round order. This is the smallest **observed** prefix, not a claim that all shorter action sequences were minimized. Heap flags may vary by host.

### F-K4 — room-yield

Growth allowance exceeded: heap, routines, domNodes.

- heap: twin slope 7852.848; original slope 7742.271; fitted twin growth 14064450.702.
- routines: twin slope 0.061; original slope not counted (library-only metric); fitted twin growth 110.086.
- domNodes: twin slope 0.430; original slope 0.430; fitted twin growth 770.603.

Routine and DOM counts plateau once the fixture's 200-message limit is filled. The final 100 rounds have zero routine and DOM slope; owned counters reach zero on disposal. This part is bounded application data growth, not evidence of leaked active owners. The heap growth remains an open lead.

Smallest recorded prefix crossing the growth rule: 12 rounds. Replay:

```sh
pnpm soak --only room-yield --seed 109 --minutes 60 --rounds 12 --out /tmp/F-K4.json
```

Final round's authored step indices/reset actions: `["room-switch",1,2,3,7,8,9,10,"room-switch",1,2,3,4,5,6,"room-switch",12]`. The seed reconstructs the preceding round order. This is the smallest **observed** prefix, not a claim that all shorter action sequences were minimized. Heap flags may vary by host.

### F-K5 — todos-yield

Growth allowance exceeded: heap.

- heap: twin slope 12812.336; original slope 12798.219; fitted twin growth 17540088.006.

Smallest recorded prefix crossing the growth rule: 40 rounds. Replay:

```sh
pnpm soak --only todos-yield --seed 109 --minutes 60 --rounds 40 --out /tmp/F-K5.json
```

Final round's authored step indices/reset actions: `["todos-start",9,10,11,12,13,14,15,16,17,18,19,20,6,7,8,4,5,"todos-end"]`. The seed reconstructs the preceding round order. This is the smallest **observed** prefix, not a claim that all shorter action sequences were minimized. Heap flags may vary by host.

### F-K6 — todos-yield-h

Growth allowance exceeded: heap.

- heap: twin slope 12997.725; original slope 12524.421; fitted twin growth 21342264.794.

Smallest recorded prefix crossing the growth rule: 49 rounds. Replay:

```sh
pnpm soak --only todos-yield-h --seed 109 --minutes 60 --rounds 49 --out /tmp/F-K6.json
```

Final round's authored step indices/reset actions: `["todos-start",17,18,19,20,4,5,13,14,15,16,6,7,8,9,10,11,12,"todos-end"]`. The seed reconstructs the preceding round order. This is the smallest **observed** prefix, not a claim that all shorter action sequences were minimized. Heap flags may vary by host.

## Reduced reproductions and controls

All valid diagnostic runs below preserve parity and capture zero errors. Controls clear Vitest call history before each forced GC, keeping the mock implementations and app state. Route controls also replace pushState with replaceState (a diagnostic change to history behavior, not the primary run). Positive slopes persist in both apps; the cause is not isolated to solid-yield. These short controls are not substitutes for the five-minute sessions.

| Diagnostic | Rounds | Original heap KiB/round | Twin heap KiB/round | Heap MiB after twin disposal |
| --- | ---: | ---: | ---: | ---: |
| effect-search | 100 | 72.481 | 85.361 | 58.733 |
| effect-retry | 100 | 97.373 | 109.247 | 60.669 |
| effect-supersede | 100 | 17.819 | 18.542 | 51.573 |
| effect-checkout | 100 | 46.196 | 47.576 | 57.229 |
| effect-cleared | 100 | 325.368 | 343.850 | 86.428 |
| hn-control | 100 | 11.665 | 12.908 | 63.869 |
| rendering-control | 40 | 26.555 | 31.448 | 38.282 |
| room-control | 500 | 17.775 | 18.813 | 49.605 |
| todos-control | 150 | 16.842 | 17.526 | 37.945 |
| todos-h-control | 150 | 16.852 | 17.444 | 38.957 |
| effect-idle | 100 | 0.979 | 0.982 | 46.565 |
| effect-switch | 100 | 61.582 | 71.829 | 58.046 |
| effect-retry-fail | 100 | 59.999 | 70.140 | 56.687 |
| effect-switch-cleared | 100 | 58.918 | 69.263 | 57.766 |

F-K1 also reproduces with **three authored steps**, repeated: step 9, clear the query; step 10, type vite with the scripted failing network; step 12, advance 4000 ms through retries. The log is already capped at 100 entries in the app, and this loop creates no orders. Clearing spy history does not remove the trend. This is the smallest action loop tried, not an exhaustive minimization over all timing values.

```sh
SOAK_CLEAR_MOCKS=1 pnpm soak --only effect-yield --scenario switch --rounds 100 --minutes 3 --out /tmp/F-K1-small.json
```

That control grows 69.263 KiB/round in the twin; original 58.918. An idle control (step 0 only) provides the harness overhead comparison in the table. Owned counters are zero after disposal, so this is retained process heap without a demonstrated live-owner leak. F-K2, F-K3, F-K5 and F-K6 remain process-heap leads with their exact seeded prefixes above; no runtime cause or fix is claimed.

## Evidence

The compact JSON next to this report preserves slopes, first/last samples and reproduction sequences. The compressed sample archive contains every round for both apps; it can be decompressed and fed to the analysis helper to recompute fits.


Runtime counter source: `0c2c713`; final harness: `199e19e`; fixture base: `de12097`, branch `harness/soak`. Normal builds were restored after every run.

Evidence: [compact results](soak-report.json), [all per-round samples](soak-report-samples.json.gz).

Validation before each local commit: `pnpm build` and the full baseline gate GREEN. Final gate: 46 PASS, 0 FAIL, 1 SKIP (manual soak), 331 seconds; no baseline regressions. Fit/seed unit checks: 3 PASS. The compressed archive was decompressed and its sample counts and heap fits matched the compact report.

## Follow-up classification — 2026-10-09

The interrupted work was coherent and was preserved in local commit `24ad415`
(`wip(soak): preserve heap controls and Effect bridge investigation`) after a full
green gate. No stash was needed. The bridge change was subsequently removed: it
released an extra fiber but did not resolve the growing owner chain, which is
also present in the plain-Solid original. No `packages/yield` runtime change is
justified by these findings. The iterator behavior tests remain. Harness request-lifetime fixes and the bridge
rollback are committed locally as `4bcb05d`.

Each finding now has a fresh 200-round comparison of original, twin and no-op
control, seed 109. F-K1 uses the three-step `[9, 10, 12]` failing-search loop;
F-K2–K6 use their full seeded schedules. Heap snapshots were taken at rounds
50/100/150 for F-K1 and 50/150 for the others. Both active apps received the same
actions and preserved parity. Across these six runs: 4,264 step comparisons,
zero differences, zero step failures, zero errors in all three workers, and
zero owned root/boundary/routine/pending/event counts after twin disposal.

Heap slopes below are KiB per round over rounds 101–200. The JSON also stores
the standard fit after round five. This common later window avoids some module
loading and GC effects, but does not eliminate all cache reclamation. Negative
slopes reflect reclaimed process caches. The control runs fixture installation,
command traffic, snapshots and GC with a no-op app; it does not create the active
apps' navigation entries, network records or data. A small control slope alone
cannot excuse a larger slope in an active app.

| Finding | Twin | Original | Library twin | No-op control | Classification and action |
| --- | --- | ---: | ---: | ---: | --- |
| F-K1 | effect-yield | 44.529 | 54.167 | 0.191 | Shared Solid transition retention; twin fiber amplification. Recorded; bridge mitigation removed. |
| F-K2 | hackernews-spa-yield | -9.375 | -8.835 | 0.635 | Harness mock results and navigation history. Fixed; no remaining positive heap trend. |
| F-K3 | rendering-yield | 3.793 | 4.404 | 0.137 | Harness history fixed; remaining growth is shared compiled-code/cache noise below the material-growth rule. |
| F-K4 | room-yield | 21.197 | 22.927 | 1.557 | Harness history and missing request abort context; both fixed. Bounded app messages recorded. |
| F-K5 | todos-yield | 11.527 | 11.668 | 0.526 | Harness history fixed; shared Solid store retention remains. Recorded. |
| F-K6 | todos-yield-h | 11.474 | 12.478 | 0.533 | Harness history fixed; shared Solid store retention remains. Recorded. |

### F-K1 retaining path

The strong path in the twin is:

```text
Solid module's transitions Set
  -> queue._transition._optimisticNodes[]
  -> node._queue (CollectionQueue)
  -> _output._queue._error._value (TransientError)
  -> error stack / CallSiteInfo
  -> closure context.it (bridge iterator)
  -> iterator.return.context.fiber (FiberRuntime)
```

Another path goes through `TransientError.error -> TransientNetworkError ->
error stack -> FiberRuntime`. The original has the same transition, queue,
native error and detached DOM path, without the typed `TransientError` wrapper.
Immediate dominators place the queue and error above the retained fibers, rather
than a live bridge fiber being the root of the leak. The capped string log is
not the retaining owner. This is shared upstream Solid retention with additional
fiber retention in the twin, not a retaining collection in `packages/yield`.

Between rounds 50 and 100, each app adds 100 `CollectionQueue` objects and 600
`SymbolTreeNode` objects. Between 50 and 150 those deltas double to 200 and 1,200.
Original `FiberRuntime` counts rise by 50 then 100; twin counts by 100 then 200.
The no-op control adds none of these queues or DOM objects. The earlier WIP
mitigation removed the iterator's extra fiber reference, but the native error
stack still retained fibers and both apps still grew. Per the original-comparison
rule, that mitigation was removed and the shared behavior is recorded.

### Harness fixes and other retained objects

Before cleanup, Hacker News retains responses through
`global.fetch.mock.settledResults[] -> value -> Response`, including response
bodies. Its old 50–200 snapshot comparison adds 121 response objects. The fresh
50–150 comparison has no response-count growth. Clearing all mocks at each
sample releases call, result and settled-result records while preserving mock
implementations. The 200-sample test checks all three arrays and continued use.

jsdom also retains old navigation records through
`window._sessionHistory._entries[]`. Old twin snapshot entry counts at rounds
50/200 were Hacker News 752/3,002, rendering 351/1,401, room 151/601, and both
todos variants 153/603. Samples now keep only the current entry, URL and state;
within-round navigation still runs as authored. Every fresh sample has one
history entry. A 200-round test verifies URL/state preservation and subsequent
navigation. The helper explicitly checks jsdom's private layout. These are
harness fixes, not app changes.

Rendering's fresh snapshots add no `CollectionQueue`, `TargetShape` or DOM tree
objects in either active app. The largest increases are V8 compiled-code and
bytecode objects in both apps; the remaining fitted growth is below the report's
material-growth rule. F-K2 and F-K3 are closed as harness findings, with residual
process/JIT noise recorded rather than described as a library leak.

Both todos originals and twins retain Solid store objects through an owned
computation's closure context: `fam.overlaid -> Set -> TargetShape`. From 50 to
150, F-K5 adds 399 original versus 400 twin shapes; F-K6 adds 399 versus 401.
The no-op control adds none. This is shared Solid store retention after the
harness history fix; it is recorded, not fixed in the yield runtime.

Room's early snapshots add the same 100 store shapes and 594 DOM tree objects
in both apps. The shapes are reachable from the room module's live
`Map -> room.messages[] -> message` data, through the live-key store cache.
Both originals and twins cap each room at 200 messages. The stored 1,797-round
run was rechecked: its final 100 rounds have zero DOM slope in both apps and
zero twin routine slope. The shorter 200-round growth is still filling that
bounded buffer.

The 1,200-round extension exposed a second harness bug after the data plateau:
`room module -> rooms Map -> room.waiters Set -> wake -> promise reactions ->
watchMembers -> AsyncGeneratorRequest`. Both apps add exactly 800 queued async
generator requests and 1,400 promises between rounds 1,050 and 1,150, despite
zero DOM and store-shape growth. The fake wire runs server bodies in a client
context, where `getRequestEvent()` has no request; the source's `gone()` therefore
returns no abort signal. Calling `return()` cannot finish a generator parked on
its change notification. This is the test transport's missing request lifetime,
not an app-source retaining behavior.

The fixture now uses an asynchronous request context and aborts each streamed
request on disconnect, reconnect and iterator return. A Vitest setup file
supplies that request to both originals and twins. A 200-round regression checks
that parked reads and finalizers finish, plus a reconnect check. The fixed
1,200-round replay preserves parity and reports zero errors. Its rounds
1,050–1,150 add **zero** async-generator requests, promises, store shapes or DOM
objects in both apps, versus +800/+1,400 requests/promises before the fix.

| F-K4 after request-lifetime fix | Original | Library twin | No-op control |
| --- | ---: | ---: | ---: |
| Heap KiB/round, rounds 1,101–1,200 | 0.283 | 0.126 | 0.020 |
| DOM-node slope | 0 | 0 | 0 |
| Routine slope | 0 | 0 | 0 |

The post-fix heap slopes are within the noise allowance and near the no-op
control. F-K4's harness retention is closed; its earlier DOM/routine rise is
bounded application data. The six-row table above retains the initial
200-round comparison, before this additional request-lifetime fix. Both
1,200-round extensions and their samples are included in the follow-up evidence.
The fixed long comparison is reproducible with:

```sh
SOAK_SNAPSHOT_ROUNDS=50,150,1050,1150 pnpm soak --only room-yield --rounds 1200 --minutes 10 --control yes --out /tmp/room-plateau.json
```


### Evidence and validation

[Classification results](soak-classification.json) contain both fit windows,
constructor count/self-byte changes, strong paths, immediate dominator chains,
snapshot hashes, disposal counters and error totals.
[Compressed follow-up samples](soak-classification-samples.json.gz) contain every
round for all three workers. Full V8 snapshots remain local diagnostics under
`/tmp/soak-final-*-raw/` and `/tmp/soak-fixed-room-raw/`; they are not checked in. The helper reports self bytes,
not retained-size estimates, and excludes weak table shortcuts from paths.

Reproduce the six short comparisons with the runner's `--rounds 200 --control yes`
options, seed 109, and `SOAK_SNAPSHOT_ROUNDS=50,100,150`; use `--scenario switch`
for F-K1. See the harness README for snapshot diff commands and the opt-outs
`SOAK_CLEAR_MOCKS=0 SOAK_KEEP_HISTORY=1` for reproducing the old driver.

Fixed: mock record retention, old jsdom navigation entries and fake-wire request
aborts. Recorded: shared Solid transition/error/DOM retention (F-K1), bounded
room data (F-K4), shared Solid store retention (F-K5/F-K6), and small process/code
cache effects. No app-source or yield runtime memory change remains. No
retaining collection in `packages/yield` was found, so no new library heap
regression test was added. The gate includes deterministic heap-analysis and
200-round harness cleanup tests, bridge behavior tests, and 200 parked-request
closures/reconnect checks.

The full baseline gate was GREEN before each local commit: WIP preservation
47 PASS / 0 FAIL / 1 SKIP (154 seconds); harness fix 47 / 0 / 1 (123 seconds);
report commit 47 / 0 / 1 (134 seconds). The sole SKIP is the manual report-only
soak. All three full runs had no baseline regressions. Ordinary library builds
were restored after every soak. The 10,800-sample archive was decompressed and
its fits, error/parity totals, one-entry history samples and disposal counters
were checked against the classification JSON. No commits were pushed.
