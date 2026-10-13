# Booking — issue #2's primitives, in userland

Not a twin: issue #2's lens, state slots and container, written with `solid-yield`'s exports alone (D-118), and a page that uses them.

- `src/lib/lens.ts` (a convention: `{ at, set }`, `focus`), `src/lib/slot.ts` (`createSlot` required or standalone, `yield* slot(S)`), `src/lib/compose.tsx` (`compose(schema)`: one store, `parts`, `provide`).
- `src/app.tsx`: the outbound `DateRangePicker` and `GuestCount` through `booking.provide`, a second picker under its own provider on `returnDates`, `GuestsPicker` through props, a total memo across them.

```bash
pnpm test && pnpm typecheck && pnpm lint   # 4 runtime tests; tests/types.tsx: two refusals of a missing provider
```
