---
"@solidjs/blocks": minor
"@solidjs/eslint-plugin-blocks": patch
---

Prop colors are declared, not inferred by the type linker (D-023, D-024, D-029, D-056 as amended by D-068).

- **`Props<{ … }>` replaces `TypedProps<P, "Key">`** (removed, with `PropColor`, `PropColors` and `PropColorsOpen`). A component declares its props as a plain object type inside `Props<…>`, which maps each field to a read: `function* (props: Props<{ todo: Todo; label: string }>)`. A bare type is settled and never fails (D-024): `yield* props.todo.title` is a `Read<false, never>`.
- **`Source<T, E = never, P extends boolean = false>`**: the parameters are reordered so that the failure comes second and the pending flag last. This affects `Source`, `Path`, `SettledSource`, `readStore`, `latestOf`, `$untrack` and every op signature. One type declares every color: `Source<T, E>` (may fail), `Source<T, E, true>` (may be pending and fail), `Source<T, never, true>` (pending, never fails). There is no `Async` alias. A declared failure must be a `Failure` with a literal `kind` (D-034): `Props<{ x: Source<T, unknown, true> }>` is `[FAILURE_KIND]`.
- **The call site checks the declared color.** A bare prop takes a value, a settled source or path, or a hole that reads only settled sources. A pending or failing source, or a hole that reads one, is refused with `SettledProp<"[SETTLED_PROP] prop `todo` is settled: pass a settled value, or declare it Source<T, E, true>">`. A prop declared `Source<T, E, true>` takes anything within that color (settled ⊂ pending, `never` ⊂ `E`). Hole props are typed by what they yield (`HoleProp<T, E, P>`), so a pending hole no longer passes a settled prop. `h(Comp, { children })` checks `children` against the declared type; it used to be `unknown`.
- **Pass-through components are generic (D-029).** `function* <E, P extends boolean>(props: Props<{ todo: Source<Todo, E, P> }>)` keeps its type parameters, so its view carries each caller's colors. `Component<…>` is now a plain function type. The component mark moved onto the view it returns (`ComponentView<P, E>`), which `TagType` refuses and `no-component-tag` (with type information) detects.
- **A declared color is permission only (D-040).** Its pending and failures reach the nearest `Loading` / `Errored` wherever that is. `render` / `hydrate` now accept a root that may fail, as long as it is not pending: a failure with no `Errored` is re-thrown (D-033, D-059).
- **`Errored`'s `fallback` may be a lazy view** (`function* () { return <…/>; }`), as other flow controls' fallbacks are (D-066). It used to be run as a row.
- **New type exports**: `Props`, `PropsArgs`, `HoleProp`, `SettledProp`, `ComponentView`, `ViewPending`, `ViewFails`, `ViewYield`, `ViewReturn`, `NoJsxViewRule`.
