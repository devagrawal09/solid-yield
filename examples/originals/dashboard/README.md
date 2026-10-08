# Operations dashboard

Original only; for sugar/native mode. This is plain Solid 2 with no solid-yield imports.

One context holds the date range and team selection. The summary, SVG chart,
incidents, roster, notes, and detail page read those shared filters. Server
functions return delayed in-process data; no external service is needed.
The range changes fetched data. Team selection derives each panel's visible
data from the response. The roster fetches once per overview visit.

The chart derives its scale, grid, points, line and filled area from the series.
Latency averages teams; request counts add them. Incident rows acknowledge
optimistically, then reload on success or roll back with an `AckFailed` message.
The billing webhook needs provider confirmation and consistently rejects an
acknowledgement. Missing details throw `NotFound` at the route boundary.

The summary refreshes every 30 seconds and stops when the overview unmounts.
Shift notes use a local signal and a browser-storage effect. Storage failures
leave an editable note for the current visit. Filters survive route navigation;
notes survive an overview remount.

```sh
pnpm -C examples/originals/dashboard dev
pnpm -C examples/originals/dashboard typecheck
pnpm -C examples/originals/dashboard build
pnpm -C examples/originals/dashboard build:ssr
```

Open `/overview` or `/incidents/inc-101`. `src/main.tsx` is the CSR entry;
`stream/entry-server.tsx` streams a full document and `stream/client.tsx`
hydrates it, following the docs original.

## Checks

```sh
pnpm -C examples/originals/dashboard test
pnpm -C examples/originals/dashboard ssr-smoke
pnpm -C examples/originals/dashboard hydrate-smoke
```

The shared script at `examples/harness/dashboard/script.ts` checks 30 states
against independently written content expectations. It covers loading,
range/team changes, sorting, optimistic acknowledgement success and failure,
metric selection, notes and storage, a simulated refresh tick, detail navigation,
the missing-detail boundary, and restoring notes after returning to overview.
It is ready to reuse against a native transform; there is no hand-written twin.

SSR and hydration each check `/overview`, `/incidents/inc-101`, and
`/incidents/missing`. The missing route must serialize its public typed error
and hydrate to the not-found message. The overview must save a note after
hydration. The smoke checks fail on runtime diagnostics, mismatches, unhandled
rejections, missing content, or replaced server root nodes.
As in the existing hydration harness, post-hydration server fetches are held;
the 30-step client script exercises the fake API directly.
