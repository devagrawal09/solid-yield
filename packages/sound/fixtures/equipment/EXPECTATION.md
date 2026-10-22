# Equipment Checkout — the slice expectation, line by line

The ten `src/` files are byte-identical copies of the reference app (verified by
`test/harness.test.mjs` when the reference directory is present). `env.d.ts` is the
harness's CSS-module shim, not part of the app.

## What the slice sees

- `useContext(EquipmentContext)` (CreateForm 4, Detail 5, EquipmentRow 5,
  FailureControls 5, Inventory 7) is **outside the subset** (context/services is the
  next area): one `UNANALYZED_BOUNDARY` warning each; `service` is the worst case —
  every member read is possibly pending and possibly failing with `unknown`, every
  method call has no failure information.
- `createEquipmentService(props.api ?? createApi())` (App 11) creates reactive state
  outside a component (a state factory): warning at the call; `service` in App is the
  worst case too. `<EquipmentContext value={service}>` (App 12): a context provider,
  warning.
- `props.api` in App is a held prop (main.tsx renders `<App />` with no api).

## Errors the slice expects (18)

| where | code | why |
|---|---|---|
| App 13 `onClick={service.reload}` | UNHANDLED_HANDLER_FAILURE | the handler is a worst-case function |
| App 15 `{service.notice()}` | ASYNC_OUTSIDE_LOADING_BOUNDARY | worst-case read rendered outside any Loading; the root is `main.tsx:6` |
| App 15 `{service.notice()}` | ERROR_OUTSIDE_ERRORED_BOUNDARY | same read, outside any Errored |
| App 17 retry `onClick={() => { service.reload(); reset(); }}` | UNHANDLED_HANDLER_FAILURE | `service.reload` unknown; `reset` is Errored's and never fails |
| CreateForm 19 `onSubmit={submit}` | UNHANDLED_HANDLER_FAILURE | `await service.create(…)` under try/**finally** — nothing catches |
| EquipmentRow 44 `onClick={edit}` | UNHANDLED_HANDLER_FAILURE | `edit()` reads `item()`, a memo over the worst-case `service.list()`: a failing memo read in a handler throws. **Today's checker misses this** |
| EquipmentRow 45 `onChange={changeStatus}` | UNHANDLED_HANDLER_FAILURE | `await service.status(…)` under try/finally |
| EquipmentRow 46 `onClick={remove}` | UNHANDLED_HANDLER_FAILURE | `await service.remove(…)` under try/finally |
| EquipmentRow 48 `onSubmit={save}` | UNHANDLED_HANDLER_FAILURE | `await service.update(…)` under try/finally |
| Detail 8 retry handler | UNHANDLED_HANDLER_FAILURE | `service.reload()` unknown |
| FailureControls 9, eight buttons | UNHANDLED_HANDLER_FAILURE ×8 | `service.api.failNext/setLatency` directly or through `arm()` |

Discharged obligations (no error): Inventory's and EquipmentRow's pending / failing
reads (`service.list()`, `item()`, `filtered()`) are covered by App's
`<Errored><Loading>` around `<Inventory>` (App 17–19); Detail's `item()` reads sit
inside Detail's own `<Errored><Loading>` (Detail 8–9). `onClick={props.onClose}`
(Detail 7) and `onClick={() => props.onSelect(props.id)}` (EquipmentRow 44) call
callback props whose only callers pass `setSelected` / `() => setSelected("")`
(through Inventory's forwarding): setters never fail, so no error — **today's
checker reports EquipmentRow 44 as EVENT_REJECTS unknown**.

## Differences from today's checker (legacyActual: 10 EVENT_REJECTS)

Today's checker resolves the provider's implementation (D-127 §3: provider methods),
so `service.update/create/remove` are known to catch inside `commit()` and only
`changeStatus` (via `isStatus`/`select.value`) and the eight FailureControls
handlers are reported; the slice does not analyze context (next area), so every
`service.*` call is the worst case: 18 errors instead of 10. It also finds one real
hole today's checker misses (`edit()` reading a possibly failing memo) and drops one
false positive (`props.onSelect`, traced to a setter).

## Open

- Whether a read of a possibly pending value in a **handler** (`item()` in `edit`)
  should also be reported: rc.17 serves the stale value while refreshing and throws
  only while uninitialized; the slice does not report it (SLICE.md "Not decided").
- The context area will replace the 5 useContext warnings and the worst-case service
  with the provider's actual value, which should bring the count back toward 10
  (`commit()` catches), keeping the `edit()` finding.
