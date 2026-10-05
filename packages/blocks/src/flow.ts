/*
 * Flow controls and boundaries for block apps: Solid's own, typed for
 * blocks, with render callbacks adapted so that
 *
 * - a callback's arguments are reads (`yield* item.title`, `yield* index`),
 *   never raw values that would be read without `yield*`;
 * - a callback may be a row block (a bare `function*`, or a named generator
 *   declared in a setup): its body is a setup that runs once per row and
 *   returns the row's view, as a `$component`'s does.
 *
 * Only the children are adapted; every other prop is forwarded as a getter,
 * so the flow control reads it where it always did.
 */
import {
  createComponent,
  Errored as SolidErrored,
  For as SolidFor,
  Loading as SolidLoading,
  Match as SolidMatch,
  Repeat as SolidRepeat,
  Show as SolidShow,
  Switch as SolidSwitch,
  untrack,
  type Accessor
} from "solid-js";
import {
  BOUNDARY,
  isGeneratorFunction,
  renderView,
  devError,
  READ,
  VIEW_MARK,
  isRowBlock,
  rowArg,
  runRow,
  throughHole,
  flowControl
} from "./runtime.js";
import type { Element } from "./element.js";
import type {
  BoundEvent,
  ComponentView,
  ErrorClass,
  Failure,
  KindCheck,
  FailsOf,
  HOps,
  MayWaitOf,
  Path,
  PendingOf,
  RowBlock,
  Source
} from "./types.js";
import type { Hole, OpsOfHole } from "./holes.js";

/**
 * What a flow control's source prop reads as (D-065): a value, a source's
 * value, or a hole's result.
 */
type ValueOf<W> =
  W extends Source<infer T, any, any> ? T : W extends () => Generator<any, infer T, any> ? T : W;
/**
 * The colors a prop or `children` carries into the flow control's view: a
 * source's read, a hole's or a lazy view's reads, a row's view's, a render
 * callback's output's, content's (`h` output, a view).
 */
type Ops<V> = V extends (...args: any[]) => infer R
  ? R extends Generator<any, any, any>
    ? OpsOfHole<V>
    : OpsOfHole<R>
  : OpsOfHole<V>;
/**
 * A flow control's view: the colors of its sources and its content (D-059,
 * D-063, D-062), and their may-wait marker (D-075).
 */
type FlowView<O> = ComponentView<PendingOf<O>, FailsOf<O>, MayWaitOf<O>>;
/**
 * A row's colors: its view's yields and output's, and its setup's (`Y`): an
 * `$effect` / `$settled` the row creates fails to the boundary above the list
 * (D-073).
 */
type RowOps<VY, R, Y> = VY | HOps<R> | Y;
/**
 * Content a flow control renders: anything `h` takes (not a generator — a
 * generator is a lazy view or a row) or a JSX element.
 */
type Content = Exclude<Hole, (...args: any[]) => Generator<any, any, any>> | Element;
/**
 * `children` in call form (D-066): a lazy view `function* () { return <…/>; }`
 * built inside the flow control (it may hold holes), content (`h` output, a
 * view), or a render callback returning content (`h`). A row — a generator
 * with the control's arguments — has its own overload.
 */
type Children<A extends unknown[]> =
  | (() => Generator<any, Content, any>)
  | Content
  | ((...args: A) => Content);

/** Forward every prop as a getter, replacing `children` (and `fallback` when given). */
function forward(props: any, adaptChildren: (children: unknown) => unknown): any {
  const out: any = {};
  for (const key of Object.keys(props)) {
    if (key === "children") continue;
    // A `fallback` written as a zero-arity `function*` is a lazy view, as
    // `children` is (D-066): built when (and each time) the control shows it,
    // never with the holding view — a fallback holding a component call
    // (`fallback: function* () { return <>{yield* Checkout()}</>; }`) sets
    // that component up only when the fallback is shown, as a tag did.
    const v = props[key];
    if (key === "fallback" && isGeneratorFunction(v) && v.length === 0) {
      Object.defineProperty(out, key, { get: () => lazyView(v), enumerable: true });
      continue;
    }
    // A source passed straight to a flow control (`each={todos}` in `h`, or
    // a call `For({ each: todos, … })`) is read where the prop is read; so is
    // a bare `function*` hole (`Show({ when: function* () { … } })`).
    Object.defineProperty(out, key, { get: () => propRead(props[key]), enumerable: true });
  }
  // Children stay as lazy as they were written: JSX element children are a
  // getter the flow control reads when (and each time) it renders the branch
  // — reading it here would build the content once, eagerly, outside the
  // branch; a render callback is a plain value, adapted once.
  const d = Object.getOwnPropertyDescriptor(props, "children");
  if (d && d.get) {
    Object.defineProperty(out, "children", {
      get: () => adaptChildren(props.children),
      enumerable: true
    });
  } else if (d) out.children = adaptChildren(d.value);
  return out;
}

/**
 * Adapt a render callback. `args` maps the flow control's raw render
 * arguments to reads; `arity` is the arity the flow control expects to see.
 */
function adapt(cb: unknown, args: (...raw: any[]) => unknown[], arity: number): unknown {
  if (typeof cb !== "function") return cb;
  // A view that is a function (a lazy page's output, a flow
  // control's) is content, not a render callback.
  if ((cb as any)[VIEW_MARK] === true) return cb;
  // A zero-arity generator is a lazy view (D-066): rendered where the
  // control renders its content — a row takes the control's arguments.
  // It is handed to Solid as a render callback (arity 1), which Solid calls
  // untracked, once per shown branch — a zero-arity function would be
  // inserted as a reactive thunk and re-rendered on every read it makes.
  if (isGeneratorFunction(cb) && cb.length === 0) return (_value: unknown) => lazyView(cb);
  const row = isRowBlock(cb);
  if (!row && (cb as any)[READ] !== undefined) return cb;
  const run = row
    ? (...raw: any[]) => runRow(cb as any, args(...raw))
    : (...raw: any[]) => (cb as any)(...args(...raw));
  if (arity === 2) return (a: any, b: any) => run(a, b);
  return (a: any) => run(a);
}

/**
 * A flow control's prop, read where the flow control reads it: always the
 * flow control's own read, never the holding view's top-level one. On the
 * server Solid's flow controls read in memos that have no observer, and a
 * memo whose first read was pending reads again when the view's template
 * resolves its hole — while the named view still runs. `flowControl` covers
 * the creation; this covers every later read (rendering-blocks' `/stream`).
 */
function propRead(v: unknown): unknown {
  return flowControl(() => throughHole(v));
}

// --- For ------------------------------------------------------------------------------------------

type EachOf<T> = T extends readonly (infer U)[] ? U : never;
type ItemOf<W> = Path<EachOf<NonNullable<ValueOf<W>>>>;

/**
 * `{yield* For({ each: todos, children: function* (todo) { setup; return
 * view(function* () { … }); } })}`: `each` is a value, a source or a hole; a
 * row's item is a path (D-055), its index a source. The rows' pending and
 * failures join the list's view (D-059, D-063), and so the holding view.
 */
function ForBlocks<W, Y, VY, R, F = never>(props: {
  each: W;
  fallback?: F;
  keyed?: boolean | ((item: EachOf<NonNullable<ValueOf<W>>>) => any);
  children: RowBlock<[item: ItemOf<W>, index: Source<number>], Y, VY, R>;
}): FlowView<Ops<W> | Ops<F> | RowOps<VY, R, Y>>;
/** `h`: `For({ each: todos, children: todo => h(TodoItem, { todo }) })`. */
function ForBlocks<W, C extends Content, F = never>(props: {
  each: W;
  fallback?: F;
  keyed?: boolean | ((item: EachOf<NonNullable<ValueOf<W>>>) => any);
  children: (item: ItemOf<W>, index: Source<number>) => C;
}): FlowView<Ops<W> | Ops<F> | OpsOfHole<C>>;
function ForBlocks(props: any): any {
  const keyedFalse = props.keyed === false;
  return SolidFor(
    forward(props, children =>
      adapt(
        children,
        (item: any, index: any) => [
          rowArg(item, keyedFalse),
          rowArg(index, typeof index === "function")
        ],
        typeof children === "function" && children.length > 1 ? 2 : 1
      )
    )
  );
}

// --- Repeat ---------------------------------------------------------------------------------------

/** `{yield* Repeat({ count: n, children: function* (index) { … } })}`: the index is a source. */
function RepeatBlocks<W, Y, VY, R, F = never>(props: {
  count: W;
  from?: number | undefined;
  fallback?: F;
  children: RowBlock<[index: Source<number>], Y, VY, R>;
}): FlowView<Ops<W> | Ops<F> | RowOps<VY, R, Y>>;
function RepeatBlocks<W, C extends Children<[index: Source<number>]>, F = never>(props: {
  count: W;
  from?: number | undefined;
  fallback?: F;
  children: C;
}): FlowView<Ops<W> | Ops<F> | Ops<C>>;
function RepeatBlocks(props: any): any {
  return SolidRepeat(
    forward(props, children => adapt(children, (index: number) => [rowArg(index, false)], 1))
  );
}

// --- Show / Match -------------------------------------------------------------------------------

type ValuePath<W> = Path<NonNullable<ValueOf<W>>>;

/**
 * `{yield* Show({ when: user, children: function* (u) { … } })}` — a row
 * whose value is a path — or a lazy view `children: function* () { return
 * <…/>; }` built when the branch shows. `when` is a value, a source or a hole
 * (`when: function* () { return (yield* n) > 1; }`).
 */
function ShowBlocks<W, Y, VY, R, F = never>(props: {
  when: W;
  keyed?: boolean;
  fallback?: F;
  children: RowBlock<[value: ValuePath<W>], Y, VY, R>;
}): FlowView<Ops<W> | Ops<F> | RowOps<VY, R, Y>>;
function ShowBlocks<W, C extends Children<[value: ValuePath<W>]>, F = never>(props: {
  when: W;
  keyed?: boolean;
  fallback?: F;
  children: C;
}): FlowView<Ops<W> | Ops<F> | Ops<C>>;
function ShowBlocks(props: any): any {
  const keyed = !!props.keyed;
  return SolidShow(
    forward(props, children => adapt(children, (value: any) => [rowArg(value, !keyed)], 1))
  );
}

/**
 * `{yield* Switch({ fallback, children: function* () { return <>{yield*
 * Match({ … })}…</>; } })}`: the first `Match` whose `when` holds.
 */
function SwitchBlocks<C extends Children<[]>, F = never>(props: {
  fallback?: F;
  children: C;
}): FlowView<Ops<C> | Ops<F>>;
function SwitchBlocks(props: any): any {
  const children = content(props, "Switch");
  const out: any = {};
  for (const key of Object.keys(props))
    if (key !== "children")
      Object.defineProperty(out, key, { get: () => propRead(props[key]), enumerable: true });
  Object.defineProperty(out, "children", { get: children, enumerable: true });
  return SolidSwitch(out);
}

/** A branch of `Switch`; its children a row (its value a path) or a lazy view. */
function MatchBlocks<W, Y, VY, R>(props: {
  when: W;
  keyed?: boolean;
  children: RowBlock<[value: ValuePath<W>], Y, VY, R>;
}): FlowView<Ops<W> | RowOps<VY, R, Y>>;
function MatchBlocks<W, C extends Children<[value: ValuePath<W>]>>(props: {
  when: W;
  keyed?: boolean;
  children: C;
}): FlowView<Ops<W> | Ops<C>>;
function MatchBlocks(props: any): any {
  const keyed = !!props.keyed;
  return SolidMatch(
    forward(props, children => adapt(children, (value: any) => [rowArg(value, !keyed)], 1))
  );
}

/**
 * A lazy view (D-066): `children: function* () { return <…/>; }`, rendered as
 * a view where the control renders its content (inside its branch, its
 * boundary, its context) — what a JSX tag's children getter did.
 */
function lazyView(body: any): unknown {
  // built untracked, as a component is (`createComponent`): what it reads
  // while it is built is its holes', never the reader's
  return untrack(() => renderView(body, "children"));
}

// --- boundaries ---------------------------------------------------------------------------------

declare const __DEV__: boolean;

/** Whether a value is an `h` / automatic-`jsx` element thunk (built where it is inserted). */
function isElementThunk(value: any): boolean {
  const symbols = Object.getOwnPropertySymbols(value);
  for (let i = 0; i < symbols.length; i++)
    if (symbols[i].description === "hyper-element") return true;
  return false;
}

/** Content that was built before the boundary: a component's DOM. */
function isBuilt(value: any): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(isBuilt);
  return typeof Node !== "undefined" && value instanceof Node;
}

/**
 * A boundary's content. JSX children arrive as a getter (built inside the
 * boundary, and again after a reset). In the call form the content is what
 * the caller passed: `children: () => UserCard({ user })` is built inside
 * the boundary; `children: UserCard({ user })` was built before it — its
 * pending reads and failures reach the boundary above instead — and is a
 * dev error. (`h` output is built where it is inserted: either is fine.)
 */
function content(props: any, name: string): () => unknown {
  const d = Object.getOwnPropertyDescriptor(props, "children");
  if (!d || d.get) return () => props.children;
  const v = d.value;
  // the call form's children (D-066): a lazy view, built inside the boundary
  if (isGeneratorFunction(v) && v.length === 0) return () => lazyView(v);
  if (
    typeof v === "function" &&
    v[READ] === undefined &&
    v[VIEW_MARK] !== true &&
    !isElementThunk(v)
  )
    return v;
  if (__DEV__ && isBuilt(v))
    throw devError(
      "BOUNDARY_CONTENT_BUILT",
      `${name}'s content was built before the boundary: pass it as a function (\`children: () => View()\`) or use the tag form.`
    );
  return () => v;
}

/**
 * Handles pending below it. Tag form takes settled or pending children
 * (`<Loading fallback={…}>{UserCard({ user })}</Loading>`); it returns a
 * view without pending, so failures still have to be handled above.
 * `on` may be a source or a hole (`Loading({ on: props.room, … })`): it is
 * read where Solid's `Loading` reads it, so the call form keys the boundary
 * too. Its colors are typed as the runtime routes them (D-071): Solid reads
 * `on` beside the boundary and drops its pending (the boundary's own: no
 * fallback shows for it, above or here), while its failure is not a
 * `Loading`'s to handle and reaches the boundary above (runtime.spec,
 * "Loading's on"). The fallback's colors pass on too.
 */
function LoadingBlocks<C, F = never, O = never>(props: {
  fallback?: F;
  on?: O;
  children: C;
}): ComponentView<
  PendingOf<Ops<F>>,
  FailsOf<Ops<C> | Ops<F> | Ops<O>>,
  MayWaitOf<Ops<C> | Ops<F> | Ops<O>>
>;
function LoadingBlocks(props: any): any {
  const children = content(props, "Loading");
  // `on` may be a source: every other prop is read through where it is read
  const out: any = {};
  for (const key of Object.keys(props))
    if (key !== "children")
      Object.defineProperty(out, key, { get: () => propRead(props[key]), enumerable: true });
  Object.defineProperty(out, "children", { get: children, enumerable: true });
  return SolidLoading(out);
}

/**
 * `Errored`'s `reset`: it re-renders the boundary's children, and cannot pend
 * or fail. A view binds it as it is, `onClick={reset}`: there are no colors
 * for a `Bind` to carry, so it is typed as already bound (D-072).
 */
export type Reset = BoundEvent<[]>;
/** An `Errored` fallback that carries no colors: content, or a render function returning content. */
type PlainFallback<E> = Content | ((error: Accessor<E>, reset: Reset) => Content);

/**
 * Handles failures below it. The fallback is content, a lazy view
 * (`fallback: function* () { return <…/>; }`, built when it shows, D-066), a
 * function receiving the error (typed with the failures of the children) and
 * a `reset`, or a row `function* (error, reset) { …; return view(…); }` whose
 * `error` is a path (a view that binds an event needs one, D-072). The
 * failure of an `$event` bound under it that nobody handles is routed here
 * (D-085).
 *
 * The fallback's own colors are not this boundary's to handle: what it reads
 * pending, and how it fails, reach the boundaries above (D-071), so they are
 * in the output.
 *
 * With `catch` it handles only those error types: `<Errored catch={[NotFound]}
 * fallback={err => …}>` removes `NotFound` from its children's failures (the
 * rest still have to be handled above), its fallback receives a `NotFound`,
 * and any other failure is rethrown to the boundary above. Each error type is
 * its own color: give each class a member of its own (`readonly kind =
 * "not-found"`), or TypeScript cannot tell two of them apart.
 */
function ErroredBlocks<C, K extends readonly ErrorClass<Failure>[], Y, VY, R>(props: {
  catch: K & KindCheck<InstanceType<K[number]>>;
  fallback: RowBlock<[error: Path<InstanceType<K[number]>>, reset: Reset], Y, VY, R>;
  children: C;
}): ComponentView<
  PendingOf<Ops<C> | RowOps<VY, R, Y>>,
  Exclude<FailsOf<Ops<C>>, InstanceType<K[number]>> | FailsOf<RowOps<VY, R, Y>>,
  MayWaitOf<Ops<C> | RowOps<VY, R, Y>>
>;
/** A lazy-view fallback carries its colors (`FY`); content and a render function carry none. */
function ErroredBlocks<C, K extends readonly ErrorClass<Failure>[], FY = never>(props: {
  catch: K & KindCheck<InstanceType<K[number]>>;
  fallback: (() => Generator<FY, Content, any>) | PlainFallback<InstanceType<K[number]>>;
  children: C;
}): ComponentView<
  PendingOf<Ops<C> | FY>,
  Exclude<FailsOf<Ops<C>>, InstanceType<K[number]>> | FailsOf<FY>,
  MayWaitOf<Ops<C> | FY>
>;
function ErroredBlocks<C, Y, VY, R>(props: {
  fallback: RowBlock<[error: Path<FailsOf<Ops<C>>>, reset: Reset], Y, VY, R>;
  children: C;
}): ComponentView<
  PendingOf<Ops<C> | RowOps<VY, R, Y>>,
  FailsOf<RowOps<VY, R, Y>>,
  MayWaitOf<Ops<C> | RowOps<VY, R, Y>>
>;
function ErroredBlocks<C, FY = never>(props: {
  fallback: (() => Generator<FY, Content, any>) | PlainFallback<FailsOf<Ops<C>>>;
  children: C;
}): ComponentView<PendingOf<Ops<C> | FY>, FailsOf<FY>, MayWaitOf<Ops<C> | FY>>;
function ErroredBlocks(props: any): any {
  const children = content(props, "Errored");
  const fallback = props.fallback as any;
  const handles = props.catch as readonly ErrorClass[] | undefined;
  // a zero-arity `function*` is a lazy view (D-066), built each time the
  // fallback shows; a generator taking `(error, reset)` is a row
  const adapted =
    typeof fallback !== "function" || !isRowBlock(fallback)
      ? undefined
      : fallback.length === 0
        ? () => lazyView(fallback)
        : (err: Accessor<unknown>, reset: () => void) =>
            runRow(fallback, [rowArg(err, true), reset]);
  return SolidErrored({
    get fallback() {
      const render = adapted || props.fallback;
      if (!handles) return render;
      // only the listed error types: any other goes to the boundary above
      return (err: Accessor<unknown>, reset: () => void) => {
        const error = err();
        if (!handles.some(C => error instanceof (C as any))) throw error;
        return typeof render === "function" ? render(err, reset) : render;
      };
    },
    get children() {
      return createComponent(BOUNDARY as any, {
        value: true,
        get children() {
          return children();
        }
      });
    }
  } as any) as any;
}

/**
 * Created untracked, as a JSX tag is (`createComponent`): called inside a
 * view's hole (`{yield* Loading({ … })}`), a flow control's creation must
 * not subscribe the hole — the hole would re-create it, and its content, on
 * every change the flow control reads. Nor are its reads the holding view's
 * top-level reads (`flowControl`: on the server Solid's flow controls read
 * their props as they are created).
 */
function untracked(fn: (props: any) => any): any {
  return (props: any) => {
    const out = untrack(() => flowControl(() => fn(props)));
    // its output is a view: `yield*` / `perform` passes it on unread
    if (typeof out === "function") out[VIEW_MARK] = true;
    return out;
  };
}

export const For: typeof ForBlocks = untracked(ForBlocks);
export const Repeat: typeof RepeatBlocks = untracked(RepeatBlocks);
export const Show: typeof ShowBlocks = untracked(ShowBlocks);
export const Match: typeof MatchBlocks = untracked(MatchBlocks);
export const Switch: typeof SwitchBlocks = untracked(SwitchBlocks);
export const Loading: typeof LoadingBlocks = untracked(LoadingBlocks);
export const Errored: typeof ErroredBlocks = untracked(ErroredBlocks);
