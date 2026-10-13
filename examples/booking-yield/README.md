# Booking — issue #2's primitives, in userland

Not a twin: issue #2's proposal written with `solid-yield`'s exports alone (D-118), and a booking page that uses it.

## Which file answers which proposal item

- **Lenses** — `src/lib/lens.ts`: `Slice<S>` (`{ at, set }`, a convention) and `focus(slice, key)`; `rowSlice(slice, id, init)` is `at(lens, key, init)`: the key read where it is used, the entry created on its first write.
- **State slots** — `src/lib/slot.ts`: `createSlot` required (a requirement, `R`) or standalone (a sentinel default: alone, the module makes its own store); `yield* slot(S)`.
- **Compose** — `src/lib/compose.tsx`: `compose(schema)`, one `$store`, `parts`, and `provide` (one provider per slotted key).
- **Modules** — `src/dateRange.tsx` (standalone slot, used twice under two providers), `src/guests.tsx` (props, and a required slot).
- **Lists and conditionals** — `src/travellers.tsx`: a `For` keyed by `t => t.id`. Row-owned state (`expanded`) is a `$store` in the row's setup, so it is created and dropped with the row ("delete on dispose", with nothing written). Page-owned state (each row's draft) lives in the page's `drafts` record. The page picks the policy for it: **prune** (`src/lib/prune.ts`, an `$effect` that deletes the entries whose key is gone; the default) or **keep** (leave the effect out, `BookingPage({ policy: "keep" })`).

```bash
pnpm test && pnpm typecheck && pnpm lint   # 7 runtime tests; tests/types.tsx: two refusals of a missing provider
```
