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
