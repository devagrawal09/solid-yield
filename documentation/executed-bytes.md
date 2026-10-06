# Executed bytes (D-105)

The full gate runs the V8 precise-coverage range tests and compares every twin and its original with [the baseline](./executed-bytes.json). It measures at load and after each named step of the authored parity driver; that driver is the shared source of mount and interactions. The temporary probes and output are removed after a run.

The metric is UTF-8 bytes of executed JavaScript source ranges. Nested unexecuted ranges subtract from their parents; overlapping ranges count once. Counts reset at each checkpoint, so a step is measured on its own. Inline source maps are excluded. App and relevant library modules count; tests and harness modules do not. Conditions are jsdom, production and Vite-transformed modules. This is an executed-source metric, not a production bundle or timing measurement.

Each phase may grow by **2% or 1024 bytes, whichever is larger**, from the recorded value. That explicit allowance addresses the run-to-run drift seen in the prototype. Every inventory and phase name must still match. Wall time remains manual under D-017. No compiler output exists on main to measure yet.

Build first, then run the full gate:

```sh
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

For a deliberate baseline update, review the cause of growth before recording and committing the new result:

```sh
node examples/harness/executed-bytes/measure.mjs --record documentation/executed-bytes.json
```

The gate has 39 steps. The existing 37-step yield-gate baseline is unchanged; the gate also requires both new steps to pass.
