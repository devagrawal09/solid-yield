/*
 * Flow controls and boundaries for yield apps: Solid's own, typed for
 * yield components, with render callbacks adapted so that
 *
 * - a callback's arguments are reads (`yield* item.title`, `yield* index`),
 *   never raw values that would be read without `yield*`;
 * - a callback may be a row routine (a bare `function*`, or a named generator
 *   declared in a setup): its body is a setup that runs once per row and
 *   returns the row's view, as a `component`'s does.
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
  ELEMENT_MARK,
  READ,
  VIEW_MARK,
  isRowRoutine,
  rowArg,
  runRow,
  throughHole,
  flowControl,
  getterSource
} from "./runtime.js";
import type { Element } from "./element.js";
import type {
  BoundEvent,
  ComponentView,
  HView,
  View,
  ErrorClass,
  Failure,
  KindCheck,
  FailsOf,
  HOps,
  MayWaitOf,
  Path,
  PendingOf,
  RequiresOf,
  RowRoutine,
  Settle,
  Source
} from "./types.js";
import type { OpsOfHole } from "./holes.js";

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
export type Ops<V> = V extends (...args: any[]) => infer R
  ? R extends Generator<any, any, any>
    ? OpsOfHole<V>
    : OpsOfHole<R>
  : OpsOfHole<V>;
/**
 * A flow control's view: the colors of its sources and its content (D-059,
 * D-063, D-062), and their may-wait marker (D-075).
 */
type FlowView<O> = ComponentView<PendingOf<O>, FailsOf<O>, MayWaitOf<O>, Settle<RequiresOf<O>>>;
/**
 * A row's colors: its view's yields and output's, and its setup's (`Y`): an
 * `$effect` / `$settled` the row creates fails to the boundary above the list
 * (D-073).
 */
type RowOps<VY, R, Y> = VY | HOps<R> | Y;
/** Text a flow control shows as it is. */
type Text = string | number | bigint | boolean | null | undefined;
/**
 * Content a flow control takes as it is (D-094): `h` output — `HView`, the
 * branded subtype of `Element` that `h` returns, built where it is inserted —
 * and text. Not a JSX element: written in the call, a JSX element is built
 * there, with the holding view, before the control decides to show it (D-066;
 * a fallback's build claims a server node while hydrating, D-092). JSX is
 * written in a lazy view, `function* () { return <…/>; }`.
 */
type Content = HView<boolean, any, boolean, any> | Text | readonly Content[];
/**
 * What a plain callback returns — `h`'s render callback, a thunk
 * `() => Card()` — built when the control calls it: content, or a view.
 */
type Rendered = Content | View<boolean, any, boolean, any>;
/** A lazy view (D-066): built where (and each time) the control shows it. JSX goes here. */
type LazyView = () => Generator<any, Element | Rendered, any>;
/**
 * `children` in call form (D-066, D-094): a lazy view `function* () { return
 * <…/>; }` built inside the flow control (it may hold holes), `h` output or
 * text, or a callback returning one (`h`'s render callback, a thunk). Never a
 * JSX element, nor a callback returning one. A row — a generator with the
 * control's arguments — has its own overload.
 */
export type Children<A extends unknown[]> = LazyView | Content | ((...args: A) => Rendered);
/** A flow control's `fallback` (D-092, D-094): a lazy view, `h` output or text. */
type Fallback = LazyView | Content;
/**
 * D-094: the type of a slot that takes `A` and was given `V`. Within `A`, `V`
 * itself. A JSX element (an `Element` that is not `h` output or text) is
 * refused with the message alone: a property TypeScript prints in full
 * (`...`: it escapes `…`). Anything else is checked against `A` with the
 * message beside it, so it shows there too (a built component view, `h`'s
 * generic component overload, where `V` is erased to `unknown`). A
 * conditional rather than an intersection: TypeScript infers `V` through
 * both branches, prints the message rather than distributing it over
 * `Element`'s members, and a render callback's parameters are still typed
 * from the slot. The message is written inline, not as a named alias, so
 * that TypeScript prints it rather than the alias's name.
 */
export type LazyParam<V, A, Slot extends string> = [V] extends [A]
  ? V
  : [V] extends [Element]
    ? {
        readonly [K in `[LAZY_VIEW] ${Slot} is a lazy view: function* () { return <.../>; }`]: never;
      }
    :
        | A
        | {
            readonly [K in `[LAZY_VIEW] ${Slot} is a lazy view: function* () { return <.../>; }`]: never;
          };

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
  const row = isRowRoutine(cb);
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
 * the creation; this covers every later read (rendering-yield's `/stream`).
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
function ForYield<W, Y, VY, R, F>(props: {
  each: W;
  fallback?: LazyParam<F, Fallback, "fallback">;
  keyed?: boolean | ((item: EachOf<NonNullable<ValueOf<W>>>) => any);
  children: RowRoutine<[item: ItemOf<W>, index: Source<number>], Y, VY, R>;
}): FlowView<Ops<W> | Ops<F> | RowOps<VY, R, Y>>;
/** `h`: `For({ each: todos, children: todo => h(TodoItem, { todo }) })`. */
function ForYield<W, C extends Rendered | Element, F>(props: {
  each: W;
  fallback?: LazyParam<F, Fallback, "fallback">;
  keyed?: boolean | ((item: EachOf<NonNullable<ValueOf<W>>>) => any);
  children: (item: ItemOf<W>, index: Source<number>) => LazyParam<C, Rendered, "children">;
}): FlowView<Ops<W> | Ops<F> | OpsOfHole<C>>;
function ForYield(props: any): any {
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
function RepeatYield<W, Y, VY, R, F>(props: {
  count: W;
  from?: number | undefined;
  fallback?: LazyParam<F, Fallback, "fallback">;
  children: RowRoutine<[index: Source<number>], Y, VY, R>;
}): FlowView<Ops<W> | Ops<F> | RowOps<VY, R, Y>>;
function RepeatYield<W, C extends Children<[index: Source<number>]> | Element, F>(props: {
  count: W;
  from?: number | undefined;
  fallback?: LazyParam<F, Fallback, "fallback">;
  children: LazyParam<C, Children<[index: Source<number>]>, "children">;
}): FlowView<Ops<W> | Ops<F> | Ops<C>>;
function RepeatYield(props: any): any {
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
function ShowYield<W, Y, VY, R, F>(props: {
  when: W;
  keyed?: boolean;
  fallback?: LazyParam<F, Fallback, "fallback">;
  children: RowRoutine<[value: ValuePath<W>], Y, VY, R>;
}): FlowView<Ops<W> | Ops<F> | RowOps<VY, R, Y>>;
function ShowYield<W, C extends Children<[value: ValuePath<W>]> | Element, F>(props: {
  when: W;
  keyed?: boolean;
  fallback?: LazyParam<F, Fallback, "fallback">;
  children: LazyParam<C, Children<[value: ValuePath<W>]>, "children">;
}): FlowView<Ops<W> | Ops<F> | Ops<C>>;
function ShowYield(props: any): any {
  const keyed = !!props.keyed;
  return SolidShow(
    forward(props, children => adapt(children, (value: any) => [rowArg(value, !keyed)], 1))
  );
}

/**
 * `{yield* Switch({ fallback, children: function* () { return <>{yield*
 * Match({ … })}…</>; } })}`: the first `Match` whose `when` holds.
 */
function SwitchYield<C extends Children<[]> | Element, F>(props: {
  fallback?: LazyParam<F, Fallback, "fallback">;
  children: LazyParam<C, Children<[]>, "children">;
}): FlowView<Ops<C> | Ops<F>>;
function SwitchYield(props: any): any {
  const children = content(props, "Switch");
  const out: any = {};
  for (const key of Object.keys(props))
    if (key !== "children")
      Object.defineProperty(out, key, { get: () => propRead(props[key]), enumerable: true });
  Object.defineProperty(out, "children", { get: children, enumerable: true });
  return SolidSwitch(out);
}

/** A branch of `Switch`; its children a row (its value a path) or a lazy view. */
function MatchYield<W, Y, VY, R>(props: {
  when: W;
  keyed?: boolean;
  children: RowRoutine<[value: ValuePath<W>], Y, VY, R>;
}): FlowView<Ops<W> | RowOps<VY, R, Y>>;
function MatchYield<W, C extends Children<[value: ValuePath<W>]> | Element>(props: {
  when: W;
  keyed?: boolean;
  children: LazyParam<C, Children<[value: ValuePath<W>]>, "children">;
}): FlowView<Ops<W> | Ops<C>>;
function MatchYield(props: any): any {
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

/**
 * Whether a value is `solid-yield/h` / automatic-`jsx` output, an element
 * thunk built where it is inserted: the library's own mark (D-004, D-095).
 */
function isElementThunk(value: any): boolean {
  return value[ELEMENT_MARK] === true;
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
function LoadingYield<C, F, O = never>(props: {
  fallback?: LazyParam<F, Fallback, "fallback">;
  on?: O;
  children: LazyParam<C, Children<[]>, "children">;
}): ComponentView<
  PendingOf<Ops<F>>,
  FailsOf<Ops<C> | Ops<F> | Ops<O>>,
  MayWaitOf<Ops<C> | Ops<F> | Ops<O>>,
  Settle<RequiresOf<Ops<C> | Ops<F> | Ops<O>>>
>;
function LoadingYield(props: any): any {
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
/**
 * An `Errored` fallback (D-094): a lazy view, `h` output or text, or a render
 * function receiving the error and `reset`. A render function is called when
 * the fallback shows, so it may return JSX; a JSX element given as it is may
 * not. Every form's colors are carried (`Ops`): a lazy view's reads, a render
 * function's output's, `h` output's (D-071, as `h(Errored, …)` does).
 */
type ErroredFallback<E> =
  | LazyView
  | Content
  | ((error: Accessor<E>, reset: Reset) => Element | Rendered);

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
function ErroredYield<C, K extends readonly ErrorClass<Failure>[], Y, VY, R>(props: {
  catch: K & KindCheck<InstanceType<K[number]>>;
  fallback: RowRoutine<[error: Path<InstanceType<K[number]>>, reset: Reset], Y, VY, R>;
  children: LazyParam<C, Children<[]>, "children">;
}): ComponentView<
  PendingOf<Ops<C> | RowOps<VY, R, Y>>,
  Exclude<FailsOf<Ops<C>>, InstanceType<K[number]>> | FailsOf<RowOps<VY, R, Y>>,
  MayWaitOf<Ops<C> | RowOps<VY, R, Y>>,
  Settle<RequiresOf<Ops<C> | RowOps<VY, R, Y>>>
>;
/** A lazy view, a render function, `h` output or text: each carries its colors. */
function ErroredYield<
  C,
  K extends readonly ErrorClass<Failure>[],
  F extends ErroredFallback<InstanceType<K[number]>> | Element
>(props: {
  catch: K & KindCheck<InstanceType<K[number]>>;
  fallback: LazyParam<F, ErroredFallback<InstanceType<K[number]>>, "fallback">;
  children: LazyParam<C, Children<[]>, "children">;
}): ComponentView<
  PendingOf<Ops<C> | Ops<F>>,
  Exclude<FailsOf<Ops<C>>, InstanceType<K[number]>> | FailsOf<Ops<F>>,
  MayWaitOf<Ops<C> | Ops<F>>,
  Settle<RequiresOf<Ops<C> | Ops<F>>>
>;
function ErroredYield<C, Y, VY, R>(props: {
  fallback: RowRoutine<[error: Path<FailsOf<Ops<C>>>, reset: Reset], Y, VY, R>;
  children: LazyParam<C, Children<[]>, "children">;
}): ComponentView<
  PendingOf<Ops<C> | RowOps<VY, R, Y>>,
  FailsOf<RowOps<VY, R, Y>>,
  MayWaitOf<Ops<C> | RowOps<VY, R, Y>>,
  Settle<RequiresOf<Ops<C> | RowOps<VY, R, Y>>>
>;
function ErroredYield<C, F extends ErroredFallback<FailsOf<Ops<C>>> | Element>(props: {
  fallback: LazyParam<F, ErroredFallback<FailsOf<Ops<C>>>, "fallback">;
  children: LazyParam<C, Children<[]>, "children">;
}): ComponentView<
  PendingOf<Ops<C> | Ops<F>>,
  FailsOf<Ops<F>>,
  MayWaitOf<Ops<C> | Ops<F>>,
  Settle<RequiresOf<Ops<C> | Ops<F>>>
>;
function ErroredYield(props: any): any {
  const children = content(props, "Errored");
  const fallback = props.fallback as any;
  const handles = props.catch as readonly ErrorClass[] | undefined;
  // a zero-arity `function*` is a lazy view (D-066), built each time the
  // fallback shows; a generator taking `(error, reset)` is a row
  const adapted =
    typeof fallback !== "function" || !isRowRoutine(fallback)
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

/**
 * @internal `Ctx.provide({ value, children })` (D-098): Solid's provider of
 * `ctx`, created as a flow control is (untracked, its output a view), its
 * `children` a lazy view built inside it. `value` is handed over as given —
 * a value, a source or a hole — and a reader's `yield* Ctx` reads it like a
 * prop.
 */
export function provideView(ctx: any, props: any): unknown {
  return untracked((p: any) => {
    const children = content(p, "provide");
    // `h` hands a function prop (a source, a hole) over as a getter that
    // reads it: kept a source, so readers read it where they read
    const d = Object.getOwnPropertyDescriptor(p, "value");
    return createComponent(ctx, {
      value: d && d.get ? getterSource(() => p.value) : p.value,
      get children() {
        return children();
      }
    });
  })(props);
}

export const For: typeof ForYield = untracked(ForYield);
export const Repeat: typeof RepeatYield = untracked(RepeatYield);
export const Show: typeof ShowYield = untracked(ShowYield);
export const Match: typeof MatchYield = untracked(MatchYield);
export const Switch: typeof SwitchYield = untracked(SwitchYield);
/**
 * Phantom: which boundary a value is. `h`'s `Loading` and `Errored` overloads
 * match on it rather than on `typeof Loading`: comparing the two boundaries'
 * overload sets structurally instantiates every fallback form's colors, which
 * TypeScript gives up on (TS2589) once those are carried (F-1).
 */
export declare const BOUNDARY_KIND: unique symbol;
export const Loading: typeof LoadingYield & { readonly [BOUNDARY_KIND]: "loading" } =
  untracked(LoadingYield);
export const Errored: typeof ErroredYield & { readonly [BOUNDARY_KIND]: "errored" } =
  untracked(ErroredYield);
