# Native dashboard: F-S36 fixed, F-S37 stop (2026-10-09)

F-S36 was a type-lowering gap. Solid `Accessor<T>` imports now name the
library's `Source<T>` contract; the unchanged provider's range and team values
both typecheck. The runtime getter stays a Source because making it callable
would hide a read in the explicit library dialect.

The first new structural reason is **F-S37**. The compiler turns `useFilters()`
into a generator that reads its context value for the missing-provider guard
and return, and can raise the author's Error. `FilterBar` delegates to that
helper during component setup. Setup admits context acquisition, creation and
cleanup, but rejects those ordinary reads and raises. The valid Solid helper
therefore becomes an invalid library setup routine. This is a compiler gap;
wrapping a foreign route in an error fallback would not repair it.

The stop rule applies here. No further dashboard compiler changes or author
patches were attempted. Run `node scripts/native-dashboard-blocker.mjs` to
check the [recorded evidence](../examples/harness/native-dashboard/structural-stop.json),
including the exact TypeScript diagnostic, mapped source/generated spans,
side-by-side code, original hashes, empty patch and unavailable colors.
`type-contract` checks the F-S36 repair separately. A green structural-stop
check pins a rejection; it does not mean dashboard acceptance passed.

## Side by side

Author, `filters.tsx:26–34`:

```tsx
export function useFilters() {
  const value = useContext(FilterContext);
  if (!value) throw new Error("Dashboard filters need a provider");
  return value;
}

export function FilterBar() {
  const filters = useFilters();
  return (
```

Generated:

```tsx
export function* useFilters() {
  const value = yield* FilterContext;
  if (!(yield* value)) return yield* __nativeRaise(__nativeFailure(["global:Error"], new Error("Dashboard filters need a provider")));
  return yield* value;
}
export const FilterBar = component(function* FilterBar() {
  const filters = yield* useFilters();

```

The TypeScript error covers generated `FilterBar` at line 53 and maps to the
authored function name at `filters.tsx:32:17`. The two provider field errors
previously mapped to `filters.tsx:23:34` and `:23:41` are gone.

## Acceptance

- Half A: **FAIL**. Lowering emits exactly the Router notice at `app.tsx:92:9`.
  The generated program fails at F-S37. It has further rejected-output errors,
  including foreign handoff checks. Those dependent errors cannot establish a
  real unhandled failure or an accepted diagnostic snapshot while setup fails.
- Half B: **FAIL / not run**, under the requested first-new-reason stop. The
  author patch is empty. Native hydrated parity, SSR, AckFailed rollback and
  NotFound comparison against patched Solid have not run. The gate's original
  dashboard tests and smokes remain independent checks of plain Solid.

## Diagnostics, verbatim

```text
[NATIVE_FOREIGN_BOUNDARY] Handle failures inside Router or its callbacks; this imported component (createRouter from @solidjs/router) is outside the native check. (examples/originals/dashboard/src/app.tsx:92:9)
```

TypeScript message (`<root>` replaces only the checkout path), mapped to
`examples/originals/dashboard/src/filters.tsx:32:17`:

```text
[TS2769] No overload matches this call.
  Overload 1 of 2, '(body: (props: unknown) => Generator<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>, any>): HoleCall<...>', gave the following error.
    Argument of type '() => Generator<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>, ViewFn<...>, any>' is not assignable to parameter of type '(props: unknown) => Generator<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>, any>'.
      Call signature return types 'Generator<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>, ViewFn<...>, any>' and 'Generator<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>, any>' are incompatible.
        The types returned by 'next(...)' are incompatible between these types.
          Type 'IteratorResult<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>, ViewFn<...>>' is not assignable to type 'IteratorResult<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>>'.
            Type 'IteratorYieldResult<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>>' is not assignable to type 'IteratorResult<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>>'.
              Type 'IteratorYieldResult<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>>' is not assignable to type 'IteratorYieldResult<SetupOp>'.
                Type 'Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>' is not assignable to type 'SetupOp'.
                  Type 'Read<false, never>' is not assignable to type 'SetupOp'.
                    Property 'kind' is missing in type 'Read<false, never>' but required in type 'Create<string, any>'.
  Overload 2 of 2, '(body: (props: unknown) => Generator<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>, any>): (props?: PropsInput<...> | undefined) => ComponentView<...>', gave the following error.
    Argument of type '() => Generator<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>, ViewFn<...>, any>' is not assignable to parameter of type '(props: unknown) => Generator<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>, any>'.
      Call signature return types 'Generator<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>, ViewFn<...>, any>' and 'Generator<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>, any>' are incompatible.
        The types returned by 'next(...)' are incompatible between these types.
          Type 'IteratorResult<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>, ViewFn<...>>' is not assignable to type 'IteratorResult<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>>'.
            Type 'IteratorYieldResult<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>>' is not assignable to type 'IteratorResult<SetupOp, ViewFn<Read<false, never> | Bind<false, NativeFailure<"unknown">>, Element>>'.
              Type 'IteratorYieldResult<Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>>' is not assignable to type 'IteratorYieldResult<SetupOp>'.
                Type 'Read<false, never> | ContextRead<RequiredContext<Filters, "<root>/examples/originals/dashboard/src/filters.tsx#FilterContext">> | Raise<...>' is not assignable to type 'SetupOp'.
                  Type 'Read<false, never>' is not assignable to type 'SetupOp'.
                    Property 'kind' is missing in type 'Read<false, never>' but required in type 'Create<string, any>'.
```

## Patch, verbatim

The author patch is the empty string, and every original source file remains
byte-identical:

```json
""
```

## Final checked colors

These are unavailable, rather than inferred colors from a rejected program.
No pending/failure/context claim or foreign-handoff admission is made.

| Panel or route | Pending / failures / may wait / required context | Shared filter |
| --- | --- | --- |
| SummaryPanel | Unavailable / unavailable / unavailable / unavailable | FilterContext |
| SeriesPanel | Unavailable / unavailable / unavailable / unavailable | FilterContext |
| IncidentsPanel | Unavailable / unavailable / unavailable / unavailable | FilterContext |
| TeamPanel | Unavailable / unavailable / unavailable / unavailable | FilterContext |
| NotesPanel | Unavailable / unavailable / unavailable / unavailable | FilterContext |
| Overview (`/`, `/overview`) | Unavailable / unavailable / unavailable / unavailable | FilterContext |
| IncidentDetail (`/incidents/inc-101`, `/incidents/missing`) | Unavailable / unavailable / unavailable / unavailable | FilterContext |

The original action catches AckFailed and writes the row's failure message;
it rethrows other failures. IncidentDetail places IncidentBody inside Errored
and Loading, including NotFound. Native failure handling and runtime parity
remain unverified under F-S37. The type-lowering table and fixtures are in
[sugar-design.md](sugar-design.md#native-type-annotations-2026-10-09).
