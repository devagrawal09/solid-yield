# Native dashboard: F-S35 stop (2026-10-08)

Both acceptance halves fail. The unchanged original reaches a compiler false
positive, so there is no checked native output for hydrated parity or SSR. The
requested stop rule applies at the first new structural reason. No author edit
or lowering workaround is attempted. The original stays byte-identical.

Reproduce with `node scripts/native-dashboard-blocker.mjs`. The
[recorded evidence](../examples/harness/native-dashboard/structural-stop.json)
pins the scope inspection, foreign Router boundary, refusal, source span,
intermediate read and host, source failure sets, and original file hashes.
The green `native:dashboard:structural-stop` gate step pins this failure;
it is not either acceptance half and does not claim runtime parity.

| Author source (`panels.tsx:47:35`) | Generated plain failure producer |
| --- | --- |
| `<dd data-kpi="success">{totals().success.toFixed(2)}%</dd>` | `() => totals().success.toFixed(2)` |

The reactive read is already inside a JSX hole. Lowering captures the method
receiver inside a plain failure producer before the hole supplies its routine
host. The read `totals()` is then refused as an unknown callback. The source
span is correctly mapped (`generated: false`); the callback refusal is wrong.
This differs from F-S34's setup context helper: the existing JSX hole should
own the receiver read. The compiler must evaluate that receiver in its hole,
then preserve the receiver and ordinary method invocation in source order.
It must not require an author to move the read or invent an error fallback.
No fix is attempted after this first structural stop.

The original's context state is created inside `FilterProvider`, not at module
level. Scope inspection therefore has no `MODULE_STATE` note. All five panels
read the same `useFilters()` context. Context lifetime, provision and foreign
Router requirement discharge have not been checked in generated dashboard
code because lowering stops before those checks.

## Acceptance

- Half A: **FAIL**. The Router boundary is valid and correctly located, but the
  extra `SUGAR_CALLBACK` is a compiler false positive.
- Half B: **FAIL / not run**. The patch is empty. There is no checked native
  program, so the dashboard's 30-step hydrated parity, happy-path SSR, AckFailed
  rollback and NotFound parity against patched Solid have not run in native mode.
  The merged gate still checks the plain-Solid original and its smokes.

## Diagnostics, verbatim

```text
[NATIVE_FOREIGN_BOUNDARY] Handle failures inside Router or its callbacks; this imported component (createRouter from @solidjs/router) is outside the native check. (examples/originals/dashboard/src/app.tsx:92:9)
[SUGAR_CALLBACK] A reactive read in an unknown callback has no routine host; use a memo, event, or hole. (examples/originals/dashboard/src/panels.tsx:47:35)
```

The boundary was inspected separately; `lowerNativeProject` throws before
returning its full diagnostic collection. These are observed stop evidence,
not an accepted author-diagnostic snapshot.

## Patch, verbatim

The patch is the empty string:

```json
""
```

## Failure sets and colors

These are the source failure analyzer's sets **before JSX handler discharge**,
not final component `FailsOf` colors. `Error` below is the built-in Error raised
by `useFilters()` if its provider is absent. `unknown` is the conservative
foreign floor, and `ChunkError` is the server-call transport contribution.
The exact class identity for NotFound is in the JSON evidence.

| Component | Source inferred failures |
| --- | --- |
| SummaryPanel | ChunkError, Error, unknown |
| SeriesPanel | ChunkError, Error, unknown |
| IncidentsPanel | ChunkError, AckFailed, NotFound, Error, unknown |
| TeamPanel | ChunkError, Error, unknown |
| NotesPanel | Error, unknown |
| Overview (route) | ChunkError, AckFailed, NotFound, Error, unknown |
| IncidentDetail (route) | ChunkError, NotFound, unknown |
| IncidentBody | Error, unknown |
| IncidentRow | ChunkError, AckFailed, NotFound, unknown |
| App | Error, unknown |
| FilterBar | Error, unknown |
| FilterProvider, Panel, Shell | unknown |

Every panel's context read contributes the same possible missing-provider Error
in this analysis. This is not a recommendation to add a handler to every panel:
App supplies the context, Panel already has Errored/Loading, IncidentDetail
already handles NotFound, and the action catches AckFailed. The raw analyzer
sets do not prove how these handlers discharge generated component failures.
Final pending, context-requirement and failure colors per panel and route are
**unavailable**, as are foreign route-handoff admission results. Reporting the
raw NotFound set as an unhandled route failure would be wrong.
