# Soak report

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
