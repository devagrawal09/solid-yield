/**
 * Type tests for D-126: declared prop types are literal. A `Source<T, E, P>`
 * is reactive (the child sees a path), a handler is itself, any other type
 * is held as declared — a bag's leaves too. A context's value follows the
 * same rule. The runtime half is held.spec.tsx; the printed messages are
 * pinned in type-messages.spec.ts. Type-checked by `test-types`.
 */
import {
  $event,
  $signal,
  component,
  constant,
  createContext,
  render,
  view,
  type ContextValue,
  type EventHandler,
  type Handler,
  type Path,
  type Props,
  type RequiresOf,
  type Source,
  type View
} from "solid-yield";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type RequiresOfComponent<C> = C extends (...args: any[]) => View<any, any, any, infer R>
  ? R
  : never;
declare const root: HTMLElement;

// --- what the child sees --------------------------------------------------------------------

type Tools = { label: Path<string>; count: Source<number>; clear: Handler; name: string };
type Seen = Props<{
  room: string;
  me: { id: string } | null;
  live: Source<string>;
  path: Path<{ n: number }>;
  onPick: Handler<[theme: string]>;
  tools: Tools;
  format: (s: string) => string;
  note?: string;
  maybe?: Source<number>;
}>;
// a bare type is held: the value itself
type _room = Expect<Equal<Seen["room"], string>>;
type _me = Expect<Equal<Seen["me"], { id: string } | null>>;
// a reactive one is a path (keys included)
type _live = Expect<Equal<Seen["live"], Path<string>>>;
type _path = Expect<Equal<Seen["path"], Path<{ n: number }>>>;
// a handler is itself
type _onPick = Expect<Equal<Seen["onPick"], Handler<[theme: string]>>>;
// a bag is held as declared: its leaves are exactly what it declares
type _tools = Expect<Equal<Seen["tools"], Tools>>;
type _leafPath = Expect<Equal<Seen["tools"]["label"], Path<string>>>;
type _leafSource = Expect<Equal<Seen["tools"]["count"], Source<number>>>;
// a plain function is held
type _format = Expect<Equal<Seen["format"], (s: string) => string>>;
// an optional prop left out is undefined in the child
type _note = Expect<Equal<Seen["note"], string | undefined>>;
type _maybe = Expect<Equal<Seen["maybe"], Path<number> | undefined>>;

// --- what the caller passes ------------------------------------------------------------------

const Child = component(function* Child(
  props: Props<{
    room: string;
    live: Source<string>;
    onPick: Handler<[theme: string]>;
    tools: Tools;
  }>
) {
  const pick = $event(function* () {
    // a handler, and a handler in a bag: called with one yield*
    yield* props.onPick("dark");
    yield* props.tools.clear();
  });
  const old = $event(function* () {
    // @ts-expect-error the old double yield: `yield* props.onPick` binds, and gives no handler to call
    yield* (yield* props.onPick)("dark");
  });
  void old;
  return view(function* () {
    return (
      <p onClick={yield* pick}>
        {props.room} {yield* props.live} {yield* props.tools.label} {yield* props.tools.count}{" "}
        {props.tools.name}
        <button onClick={[yield* props.onPick, "light"]}>light</button>
        <button onClick={yield* props.tools.clear}>clear</button>
      </p>
    );
  });
});
export const Caller = component(function* Caller() {
  const [live] = yield* $signal("x");
  const [room] = yield* $signal("lobby");
  const onPick = $event(function* (_t: string) {});
  const clear = $event(function* () {});
  const tools: Tools = {
    label: constant("l") as Path<string>,
    count: constant(1),
    clear,
    name: "n"
  };
  return view(function* () {
    return (
      <>
        {yield* Child({ room: "lobby", live, onPick, tools })}
        {yield* Child({ room: "lobby", live: constant("fixed"), onPick, tools })}
        {/* @ts-expect-error [HELD_PROP] a source for a held prop */}
        {yield* Child({ room, live, onPick, tools })}
        {/* @ts-expect-error [REACTIVE_PROP] a plain value for a reactive prop: constant(v) */}
        {yield* Child({ room: "lobby", live: "x", onPick, tools })}
        {/* @ts-expect-error [HANDLER_PROP] a plain function for a handler prop */}
        {yield* Child({ room: "lobby", live, onPick: (_t: string) => {}, tools })}
        {/* @ts-expect-error a bag's leaves must match: a string where a Path is declared */}
        {yield* Child({ room: "lobby", live, onPick, tools: { ...tools, label: "l" } })}
      </>
    );
  });
});
render(Caller, root);

// an optional handler is held too: undefined when left out, checked without a read
export const Optional = component(function* Optional(props: Props<{ onClose?: Handler }>) {
  const close = $event(function* () {
    if (props.onClose) yield* props.onClose();
  });
  return view(function* () {
    return <button onClick={yield* close}>x</button>;
  });
});
export const optionalLeftOut = Optional({});
// a generic handler prop keeps its colors
declare const failing: EventHandler<[], never, void, false, false>;
export const Forwards = component(function* Forwards(props: Props<{ onSave: typeof failing }>) {
  const save = $event(function* () {
    yield* props.onSave();
  });
  return view(function* () {
    return <button onClick={yield* save}>save</button>;
  });
});

// --- contexts --------------------------------------------------------------------------------

type _heldContext = Expect<Equal<ContextValue<Tools>, Tools>>;
type _liveContext = Expect<
  Equal<ContextValue<Source<string, never, true>>, Path<string, never, true>>
>;
// a required context's read is a requirement; a sentinel default adds none (a module that also
// works alone, D-126)
const RequiredTools = createContext<Tools, "RequiredTools">(undefined, { name: "RequiredTools" });
const NONE = Symbol("no provider");
const DefaultedTools = createContext<Tools | typeof NONE>(NONE, { name: "DefaultedTools" });
const ReadsRequired = component(function* ReadsRequired() {
  const tools = yield* RequiredTools;
  return view(function* () {
    return <i>{tools.name}</i>;
  });
});
const ReadsDefaulted = component(function* ReadsDefaulted() {
  const tools = yield* DefaultedTools;
  type _held = Expect<Equal<typeof tools, Tools | typeof NONE>>;
  return view(function* () {
    return <i>{tools === NONE ? "alone" : tools.name}</i>;
  });
});
type _required = Expect<Equal<RequiresOfComponent<typeof ReadsRequired>, typeof RequiredTools>>;
type _defaulted = Expect<Equal<RequiresOfComponent<typeof ReadsDefaulted>, never>>;
type _fold = Expect<Equal<RequiresOf<never>, never>>;
render(ReadsDefaulted, root);
// @ts-expect-error [NO_PROVIDER] the root requires "RequiredTools"
render(ReadsRequired, root);
