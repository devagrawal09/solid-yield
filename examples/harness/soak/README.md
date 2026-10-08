# Long-session soak (manual, report only)

From the repository root: `pnpm soak`. Default: 10 real minutes for each of
nine twins, in sequence. Use `--minutes 60` for an hour per twin;
`--minutes 1` for a short report, `--seed 109`, `--checkpoint 5`,
`--only rendering-yield`, `--rounds 100` for a bounded replay, or
`--out /tmp/soak.json` to select output.
A complete default run takes at least 90 minutes. No installs are needed.
`node --test examples/harness/soak/analysis.test.mjs` checks the fit and seed.

This reuses each twin's `tests/script.ts` and its Vitest/Vite config, aliases,
fixture API and fake clocks, exactly as parity does. Two persistent jsdom
workers hold the original and twin for the whole session. The app is mounted
once and disposed once. The original receives **every** round to keep its state
in step; every fifth round (and round one) compares SHA-256 DOM snapshots after
every step. Normalization matches parity, including rendering's generated IDs,
HN's URL and room's draft input value. Original errors and step failures are
also retained. A round never reloads the browser or app.

`steps` are randomized in dependency-preserving blocks, with a seeded local
random generator separate from the apps' scripted random numbers. Arbitrary
permutation would click missing controls and test invalid inputs. The schedule
names step indices in the authored script. Todos bounds its list by removing
remaining rows between rounds; docs returns home before revisiting the article;
room alternates design/infra. These few named reset steps keep data bounded and
are recorded in the reproduction sequence. The schedule covers authored actions,
including failed attempts, retry, optimistic writes, superseded searches, route
disposal, portal teardown, reconnection and lazy page imports.

Each round writes a raw JSONL sample (both apps) beside the JSON result:
process `heapUsed` after forced GC, all DOM nodes (elements, text and comments),
and library counts. The memory includes jsdom, Vite and the test worker, not
just library allocations. The worker retains no history of DOM snapshots or
samples. The separate controller computes the fit. Whole-session action order
can be replayed from twin, seed and round; first failed sequences are saved.

The runtime debug hook is **build-time opt-in**: `YIELD_SOAK_DEBUG=1` when running
`packages/yield/scripts/build.mjs`. It publishes `globalThis.__yieldSoakCounts`:

- `roots`: library render/hydrate roots, plus explicitly counted library app
  roots mounted by the parity script through Solid's render.
- `boundaries`: owned library Loading and Errored definitions.
- `routines`: owned component/row setups, memo/effect/projection definitions
  and event handlers. This counts library definitions, not private Solid owners
  or individual synchronous generator invocations.
- `pendingPromises`: suspended library memo runs and event attempts, including
  superseded runs that must finish under D-080. It is **not** a count of all
  unresolved promises in Vite, Solid, the fixture transport or the JS process.
- `eventsInFlight`: active library event bodies, including async waits.
- `eventQueueDepth`: zero. The current runtime hands events directly to Solid
  actions; it has no separate retained event queue (the future lazy builder is
  outside this harness).

All hook sites are guarded by a build constant. Normal production builds erase
counter calls and allocations; development builds have dead constant branches.
The runner builds instrumented JS before starting and restores ordinary JS in
`finally`. It does not change application behavior or close superseded memos.
Do not run a build or gate concurrently with the soak: all use the same dist.
If forcibly killed, restore with `pnpm build`.

Linear least-squares slopes are per round after discarding the first five
samples (or first fifth for small runs). A flag requires at least ten samples,
a positive slope above the allowance **and** material fitted growth. Heap:
>4 KiB/round and >max(1 MiB, 5% initial heap) total fitted growth. This filters
small jsdom/JIT/cache fluctuations but remains a lead, not proof of a runtime
leak. Roots/boundaries: >0.01/round; routines/pending/events: >0.05/round;
DOM: >0.1/round; queue: >0/round; object metrics also require >3 fitted objects.
These tolerate a few changing owners at different page endpoints while flagging
sustained retained growth. Negative counts, surviving owned objects after
cleanup, parity differences and uncaught errors require review independently
of slopes. Fits can miss nonlinear/rare growth; a clean report is limited to
these fixtures, schedule, duration, development build and host.

The gate lists `twins:soak-report` as **SKIP**, with the manual command. Even a
one-minute-per-twin check adds nine minutes to every commit, and heap measurements
depend on the host, so this is a separate manual report rather than a blocking
gate step. Findings do not change its exit code; setup/build/worker failures do.

Generate the compact report with
`node examples/harness/soak/report.mjs /tmp/soak.json documentation/soak-report.md`.
The JSON beside the Markdown preserves fits, first/last samples and replay
sequences; the full JSONL series stays beside the input.

Reduced diagnostic loops are available for `--only effect-yield` with
`--scenario search`, `retry`, `supersede`, or `checkout`. They preserve the
required authored order but exclude other blocks. Set `SOAK_CLEAR_MOCKS=1` for
a control that clears Vitest call history before each sample while keeping mock
implementations, fake clocks and application state intact. Default runs keep
the authored spies unchanged. `--build no` is only for a diagnostic run reusing
an already instrumented dist; the ready check rejects missing counters.
The report generator also writes a compressed sample archive for both apps.

`--scenario switch` reduces effect to [9, 10, 12]: clear the query, start a
failing search, advance through retries. `--scenario idle` runs step 0 only;
`--scenario retry-fail` uses [9, 10, 11, 12, 15]. All require effect-yield.
`SOAK_REPLACE_HISTORY=1` replaces pushState with replaceState for a route
control; it changes history behavior and is not used in the primary report.
Run `node examples/harness/soak/diagnostics.mjs` for the optional foreground
controls, or pass one diagnostic name to run only that case.
Pass its combined JSON as the fourth argument to report.mjs to include controls.
