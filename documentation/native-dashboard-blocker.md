# Native dashboard: F-S35 fixed, F-S36 stop (2026-10-08)

F-S35 is fixed. The JSX method receiver stays in its hole before the plain
failure producer, and arrows/functions in JSX children or attributes retain
that host through parentheses, ternaries and returned functions. Seven compiler
fixtures pass. The unchanged dashboard now lowers and returns exactly the
Router notice at `app.tsx:92:9`, with no `SUGAR_CALLBACK`.

Both native acceptance halves still fail at **F-S36**, the first new structural
reason. The shared `Filters` interface keeps Solid's callable `Accessor` fields,
while the generated provider supplies yield `Source` values. TypeScript rejects
both fields at the correct authored provider positions, `filters.tsx:23:34` and
`:23:41`. This is a compiler context facade gap. Adding an error fallback or
moving the filter state would not repair this type contract. The stop rule
applies before author edits, native parity or further compiler changes.

Run `node scripts/native-dashboard-blocker.mjs`. The
[recorded evidence](../examples/harness/native-dashboard/structural-stop.json)
contains the source/generated pair, exact diagnostics and spans, original file
hashes, empty patch, and unavailable color status for every panel and route.
The existing `native:dashboard:structural-stop` step now pins F-S36. It is a green
regression pin, not successful dashboard acceptance. No gate step is added and
no baseline entry is regenerated in this follow-up.

## Side by side

| Author's valid Solid contract | Generated contract |
| --- | --- |
| `range: Accessor<Range>` | The same callable Solid `Accessor<Range>` type is retained. |
| `team: Accessor<TeamFilter>` | The same callable Solid `Accessor<TeamFilter>` type is retained. |
| `const [range] = createSignal<Range>("24h")` | `const [range] = yield* createSignal<Range>("24h")`, producing a yield `Source`. |
| `<FilterContext value={{ range, team, setRange, setTeam }}>` | `yield* FilterContext.provide({ value: { range, team, setRange, setTeam }, ... })`; its value contract still expects Solid accessors. |

Both errors map from generated `filters.tsx:37:11` and `:38:11` to the authored
provider at line 23. The author used the correct plain-Solid values there.

## Acceptance

- Half A: **FAIL**. Lowering has exactly the expected boundary notice, but the
  generated program does not check. The two context errors are pinned as the
  first structural reason; later type errors in this rejected program are not
  an accepted author-diagnostic snapshot.
- Half B: **FAIL / not run**. No author patch is made. Native client/hydrated
  parity, streamed SSR, AckFailed rollback and NotFound comparison against
  patched Solid have not run. The merge's full gate passed the plain-Solid
  original's 30 states and its SSR/hydration smokes; the final gate checks them
  again. This does not establish native parity.

## Diagnostics, verbatim

```text
[NATIVE_FOREIGN_BOUNDARY] Handle failures inside Router or its callbacks; this imported component (createRouter from @solidjs/router) is outside the native check. (examples/originals/dashboard/src/app.tsx:92:9)
[TS2322] Type 'Source<Range, never, false>' is not assignable to type 'Accessor<Range>'.
  Type 'Source<Range, never, false>' provides no match for the signature '(): Range'.
(examples/originals/dashboard/src/filters.tsx:23:34)
[TS2322] Type 'Source<TeamFilter, never, false>' is not assignable to type 'Accessor<TeamFilter>'.
  Type 'Source<TeamFilter, never, false>' provides no match for the signature '(): TeamFilter'.
(examples/originals/dashboard/src/filters.tsx:23:41)
```

## Patch, verbatim

The author patch is the empty string:

```json
""
```

## Final checked colors, as the author would read them

| Panel or route | Final checked pending / failures / context | What it says about the shared filter |
| --- | --- | --- |
| SummaryPanel | Unavailable | Reads the shared FilterContext; its generated value contract fails checking. |
| SeriesPanel | Unavailable | Reads the same FilterContext, including the shared range and team. |
| IncidentsPanel | Unavailable | Reads the same FilterContext before filtering and sorting incidents. |
| TeamPanel | Unavailable | Reads the same FilterContext before selecting roster members. |
| NotesPanel | Unavailable | Reads the same FilterContext for its labels; its notes are local state. |
| Overview (`/`, `/overview`) | Unavailable | Composes the five panels; their shared-context colors are not checked. |
| IncidentDetail (`/incidents/inc-101`, `/incidents/missing`) | Unavailable | IncidentBody reads the same FilterContext; the route's final handoff color is not checked. |

The shared state is created inside FilterProvider, and App supplies it above
FilterBar and Router. No `MODULE_STATE` diagnostic is present. The source's
missing-provider Error and conservative unknown floor are preliminary inference
sets, not proof of an unhandled route failure. Colors containing `any` from
rejected generated output are not final checked colors. The current compiler
cannot establish the provider relationship for this interface, so no claim is
made that the route handoff is admitted or that every remaining failure is
handled.

The original action catches AckFailed and writes the row's failure message;
it rethrows other failures. IncidentDetail has Errored around Loading and
IncidentBody, including its NotFound path. Their native failure discharge and
runtime comparisons remain unverified under the stop rule. An author patch for
remaining foreign failures requires a valid checked context contract first.
