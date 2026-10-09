# Native dashboard: F-S35 repaired, F-S36 stop (2026-10-09)

F-S35 is repaired. Dashboard lowering completes; the generated producer around
`panels.tsx:47` keeps its JSX hole host. Functions in child and attribute
expressions, conditional branches and functions returned from a hole keep that
host too. The callback bridge is created by an operation driven inside the hole,
so it captures the correct runtime host. The compiler fixtures and a real
SSR/hydrated counter with returned functions and a method receiver pin this.

The next structural reason is **F-S36: context accessor contracts are retained
when their provided values become Sources**. The original is valid Solid.
Generated TypeScript rejects its existing provider at `filters.tsx:23:34`.
The source span points to the authored `range` shorthand (`generated: false`).
No author workaround or additional structural fix is attempted after this stop.

| Authored Solid                                                                | Generated native program                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `range: Accessor<Range>; team: Accessor<TeamFilter>;`                         | The interface still has these Solid accessor fields.                                                                |
| `const [range, setRange] = createSignal<Range>("24h");`                       | `const [range, setRange] = yield* createSignal<Range>("24h");` produces a `Source<Range, never, false>`.            |
| `<FilterContext value={{ range, team, setRange, setTeam }}>…</FilterContext>` | `FilterContext.provide({ value: { range, team, setRange, setTeam }, … })` requires the retained accessor interface. |

Reproduce with `node scripts/native-dashboard-blocker.mjs`. The
[recorded evidence](../examples/harness/native-dashboard/structural-stop.json)
pins the new mismatch, source mapping, foreign Router boundary, raw source
failure sets and original hashes. The existing
`native:dashboard:structural-stop` gate step now pins F-S36. No gate steps were
added, so the gate baseline is unchanged.

- Half A: **FAIL**. The Router warning is correct, but the generated context
  contract rejects correct source. There is no accepted author diagnostic set.
- Half B: **FAIL / not run**. The stop rule applies before an author patch,
  native dashboard hydrated parity, SSR, or AckFailed/NotFound comparisons.
  The gate still checks the plain-Solid original and its smokes.

## Diagnostics, verbatim

The second diagnostic is a compiler defect, not an author error:

```text
[NATIVE_FOREIGN_BOUNDARY] Handle failures inside Router or its callbacks; this imported component (createRouter from @solidjs/router) is outside the native check. (examples/originals/dashboard/src/app.tsx:92:9)
[TS2322] Type 'Source<Range, never, false>' is not assignable to type 'Accessor<Range>'.
  Type 'Source<Range, never, false>' provides no match for the signature '(): Range'. (examples/originals/dashboard/src/filters.tsx:23:34)
```

## Patch, verbatim

```json
""
```

The original files are byte-identical. Adding a handler for a failed generated
context contract would not be an author fix. The raw `Error` and `unknown` sets
in the evidence do not establish unhandled failures at foreign handoffs:
`useFilters()` throws if its provider is missing, and App already provides it.
Final failure discharge and context checks cannot be accepted while the
reconstructed context contract is invalid.

## Final checked colors

| Panel or route                    | Pending, failures, context requirements |
| --------------------------------- | --------------------------------------- |
| SummaryPanel                      | Unavailable: F-S36                      |
| SeriesPanel                       | Unavailable: F-S36                      |
| IncidentsPanel                    | Unavailable: F-S36                      |
| TeamPanel                         | Unavailable: F-S36                      |
| NotesPanel                        | Unavailable: F-S36                      |
| Overview (`/`, `/overview`)       | Unavailable: F-S36                      |
| IncidentDetail (`/incidents/:id`) | Unavailable: F-S36                      |

The source failure sets remain recorded separately, before generated handler
and provider discharge. They are not final component colors.
