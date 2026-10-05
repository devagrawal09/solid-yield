/*
 * The type model of generator blocks.
 *
 * A block is a `function*`. Everything it does is an operation it delegates
 * to with `yield*`, and TypeScript collects the delegated operations' yield
 * types into the generator's yield union. The constructors (`$component`,
 * `$memo`, `$effect`, `$event`, row blocks) constrain that union: each kind
 * of block admits a fixed set of operations, so a disallowed operation is a
 * type error at the constructor call.
 *
 * Two facts travel with values: whether reading them may be *pending*
 * (async, not yet resolved) and which errors reading them may *fail* with.
 * Operations carry them as phantom fields; `PendingOf` / `FailsOf` fold a
 * yield union into them. A third fact is a marker only: a view that binds an
 * event which may wait on a pending read *may wait* (`MayWaitOf`, D-075). It
 * never makes the view pending — the runtime does not suspend a view for a
 * call. Nothing here exists at runtime.
 */

/** Phantom: may this value / operation be pending? */
export declare const PENDING: unique symbol;
/**
 * Phantom marker (D-075): a bound handler may wait on a pending read, so the
 * view binding it may wait. Not a color: no boundary handles it, and it never
 * joins `PendingOf` (the runtime shows no `Loading` for a call). The lint
 * `no-unshown-wait` warns where it is bound.
 */
export declare const MAY_WAIT: unique symbol;
/** Phantom: the failures reading this value / performing this operation may raise. */
export declare const FAILS: unique symbol;
/** Phantom: the operation kind. */
export declare const KIND: unique symbol;
/** Phantom brand of library read sources. */
export declare const SOURCE: unique symbol;
/** Phantom brand of component views. */
export declare const VIEW: unique symbol;
/** Phantom brand of the view a block component returns (D-067). */
export declare const COMPONENT: unique symbol;
/** Phantom brand of `Props` (carries the declared props type). */
export declare const PROPS: unique symbol;
/** Phantom brand of no-JSX (`h`) output. */
export declare const HVIEW: unique symbol;
/** Phantom brand of `$event` handlers (a plain function is not one). */
export declare const EVENT: unique symbol;
/** Phantom brand of a call of an `$event` handler. */
export declare const EVENT_CALL: unique symbol;
/** Phantom brand of an `$event` handler bound in a view (`onClick={yield* save}`, D-072). */
export declare const BOUND: unique symbol;
/** Phantom key of an event call's async color. */
export declare const ASYNC: unique symbol;
/** Phantom brand of a stream an `attempt` handled. */
export declare const HANDLED: unique symbol;
/** A stream an `attempt` gave back: its failures go through the attempt's handler. */
export interface Handled {
  readonly [HANDLED]: true;
}

// --- operations ------------------------------------------------------------------

/** A tracked read of a source that may be pending (`P`) and may fail with `E`. */
export interface Read<P extends boolean = boolean, E = unknown> {
  readonly [KIND]: "read";
  readonly [PENDING]: P;
  readonly [FAILS]: E;
}
/** An async `attempt`: the block suspends until the promise settles. */
export interface Wait {
  readonly [KIND]: "wait";
}
/** A typed failure: `yield* raise(e)` or a declared `attempt` failure. */
export interface Raise<E> {
  readonly [KIND]: "raise";
  readonly [FAILS]: E;
}
/** A write through a block setter's receipt (or a call of an `$event`). */
export interface Write {
  readonly [KIND]: "write";
}
/**
 * Delegating to a call of an `$event`: a write that carries the callee's
 * colors — `P`, it waits for pending data; `A`, it does async work — and its
 * failures, so the caller's type gets them.
 */
export interface EventCallOp<
  P extends boolean = boolean,
  A extends boolean = boolean,
  E = unknown
> {
  readonly [KIND]: "call";
  readonly [PENDING]: P;
  readonly [ASYNC]: A;
  readonly [FAILS]: E;
}
/**
 * Binding an `$event` handler in a view: `onClick={yield* save}` (D-072). The
 * handler is not called; the DOM calls it. What a call may do the view
 * carries: its failures, which go to the nearest `Errored` above the bind
 * site when nobody handles the call (a DOM dispatch does not; D-085), and — as a marker, not as pending — that it may wait on pending data
 * (`W`, the handler's `P`; D-075 amended): the runtime never suspends a view
 * for a call, so a bind does not make the view pending.
 */
export interface Bind<W extends boolean = boolean, E = unknown> {
  readonly [KIND]: "bind";
  readonly [MAY_WAIT]: W;
  readonly [FAILS]: E;
}
/**
 * An `attempt` that gives back a stream (D-091). A stream keeps arriving, so
 * a reactive block holds it — a `$memo` or a `$projection` returns it — and
 * its failures arrive after the host's run, through a plain handler. An
 * `$event` does one thing and finishes: this op is not an `EventOp`. An
 * attempt yields it with the refusal's message attached (`AttemptOps`), so
 * that is what TypeScript prints where an event attempts a stream.
 */
export interface StreamAttempt {
  readonly [KIND]: "stream";
}
/**
 * Creating owned state (`$signal`, `$store`, `$memo`, `$effect`, `$settled`).
 * `E` is what the created computation may fail with where nothing reads it:
 * an `$effect`'s or a `$settled`'s body (D-073). Its failure reaches the
 * nearest `Errored` above the component, so it joins the component's
 * failures. A memo's failures are its source's (they reach whoever reads it),
 * so a memo's `Create` carries none.
 */
export interface Create<K extends string = string, E = never> {
  readonly [KIND]: "create";
  readonly kind: K;
  readonly [FAILS]: E;
}
/** `$cleanup(fn)`. */
export interface Cleanup {
  readonly [KIND]: "cleanup";
}
/** `yield* Ctx`. */
export interface ContextRead {
  readonly [KIND]: "context";
}
/** `yield* Child(props)`: the child's pending and failures, propagated, and its may-wait marker (D-075). */
export interface ChildView<P extends boolean = boolean, E = unknown, W extends boolean = boolean> {
  readonly [KIND]: "child";
  readonly [PENDING]: P;
  readonly [FAILS]: E;
  readonly [MAY_WAIT]: W;
}

export type AnyOp =
  | Read<boolean, any>
  | Wait
  | Raise<any>
  | Write
  | EventCallOp<boolean, boolean, any>
  | Create<string, any>
  | Cleanup
  | ContextRead
  | ChildView<boolean, any>
  | Bind<boolean, any>
  | StreamAttempt;

/** Operations a component's (or a row block's) setup may perform: it creates, never reads (D-042). */
export type SetupOp = Create<string, any> | Cleanup | ContextRead;
/**
 * What a JSX view's generator yields, as TypeScript sees it: the reads and
 * child views of its holes (each `yield*` in a JSX position, which the
 * transform turns into a hole), and the events it binds (`onClick={yield*
 * save}`, D-072). The view's own body reads nothing (D-032) —
 * a rule TypeScript cannot see, since it types a `yield*` in JSX and one in
 * a statement alike; the runtime (`READ_IN_VIEW`) and the lint
 * (`no-read-in-view-body`) hold it.
 */
export type ViewOp = Read<boolean, any> | ChildView<boolean, any> | Bind<boolean, any>;
/** What a no-JSX view yields: nothing (D-032). Its reads are holes, its pending and failures its output's. */
export type HViewOp = never;
/** Operations a memo (or a projection) may perform; it may return a stream an `attempt` gave (D-091). */
export type MemoOp = Read<boolean, any> | Wait | Raise<any> | StreamAttempt;
/**
 * Operations a `$settled` may perform (a sync `attempt` only): it runs once
 * after the graph settles, untracked (D-053).
 */
export type EffectOp =
  | Read<boolean, any>
  | Write
  | Cleanup
  | Raise<any>
  | EventCallOp<false, false, any>
  | StreamAttempt;
/**
 * Operations an `$effect`'s compute may perform (D-079): tracked reads and
 * failures (`raise`, a sync `attempt`'s). It is pure: a write, a `$cleanup`
 * or an event call is refused. Its value is handed to the effect phase.
 */
export type ComputeOp = Read<boolean, any> | Raise<any> | StreamAttempt;
/**
 * Operations an `$effect`'s effect phase may perform (D-079, D-083): it runs
 * after the compute, untracked, as Solid's `createEffect` effect does —
 * writes, `$cleanup`, a sync `attempt`, a synchronous event call, and
 * settled reads. A read there is untracked because the host is (as an
 * event's); it does not wait, so a source that may be pending is refused:
 * read it in the compute and pass the value.
 */
export type EffectPhaseOp =
  | Read<false, any>
  | Write
  | Cleanup
  | Raise<any>
  | EventCallOp<false, false, any>
  | StreamAttempt;
/**
 * Operations an event handler may perform. Not a stream (D-091): an event
 * does one thing and finishes; a `$memo` holds what keeps arriving.
 */
export type EventOp =
  | Read<boolean, any>
  | Write
  | Wait
  | EventCallOp<boolean, boolean, any>
  | Raise<any>;
/** Operations a no-JSX hole (a bare `function*` given to `h`) may perform: reads. */
export type HoleOp = Read<boolean, any> | Raise<any> | StreamAttempt;

// --- folding a yield union ---------------------------------------------------------

type PendingBits<Y> = Y extends Wait
  ? true
  : Y extends { readonly [PENDING]: infer P }
    ? true extends P
      ? true
      : never
    : never;
/** Whether any operation in `Y` may be pending. */
export type PendingOf<Y> = [PendingBits<Y>] extends [never] ? false : true;
/** The union of the failures of the operations in `Y`. */
export type FailsOf<Y> = Y extends { readonly [FAILS]: infer E } ? E : never;

type MayWaitBits<Y> = Y extends { readonly [MAY_WAIT]: infer W }
  ? true extends W
    ? true
    : never
  : never;
/**
 * Whether any operation in `Y` binds a handler that may wait on pending data
 * (a `Bind`, or a child view that does): the may-wait marker (D-075). Folded
 * like `PendingOf`, and never part of it.
 */
export type MayWaitOf<Y> = [MayWaitBits<Y>] extends [never] ? false : true;

type ReadPendingBits<Y> = Y extends { readonly [PENDING]: infer P }
  ? true extends P
    ? true
    : never
  : never;
/**
 * An event's first color: it reads a source that may be pending (or calls an
 * event that does), so it waits for that data.
 */
export type ReadsPendingOf<Y> = [ReadPendingBits<Y>] extends [never] ? false : true;
/**
 * An event's second color: it does async work of its own — an async
 * `attempt`, `until`, or a call of an event that does.
 */
type WaitBits<Y> = Y extends Wait
  ? true
  : Y extends { readonly [ASYNC]: infer A }
    ? true extends A
      ? true
      : never
    : never;
export type WaitsOf<Y> = [WaitBits<Y>] extends [never] ? false : true;

/** Something `yield*` can delegate to: yields `Y`, evaluates to `R`. */
export interface Yieldable<Y, R> {
  [Symbol.iterator](): Generator<Y, R, any>;
}

// --- sources -------------------------------------------------------------------------

/**
 * A readable source: `yield* source` is a tracked read. `E` is what the read
 * may fail with and `P` whether it may be pending — the order of a `Result<T,
 * E>`, the flag last (D-068): `Source<T>` is settled, `Source<T, E>` may fail,
 * `Source<T, E, true>` may also be pending. Deliberately not callable at the
 * type level: inside a block, a read is a `yield*` (a call would be a hidden
 * read).
 */
export interface Source<T, E = never, P extends boolean = false> {
  readonly [SOURCE]: T;
  readonly [PENDING]: P;
  readonly [FAILS]: E;
  [Symbol.iterator](): Generator<Read<P, E>, T, any>;
}
/** A source with nothing left to handle. */
export type SettledSource<T = unknown> = Source<T, never, false>;
/** Any source (for constraints). */
export type AnySource = Source<any, any, boolean>;

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type Opaque =
  | Primitive
  | ((...args: any[]) => any)
  | Node
  | Date
  | RegExp
  | Map<any, any>
  | Set<any>
  | Promise<any>;

/**
 * A path into an object: `yield* x.a.b` reads `a.b` as one tracked read.
 * Arrays are walked by index and `length`; functions, DOM nodes and other
 * opaque values stop the path.
 */
export type Path<T, E = never, P extends boolean = false> = Source<T, E, P> &
  PathKeys<NonNullable<T>, Nullish<T>, E, P>;
/**
 * The keys of a path. Through a nullable value a key may read `undefined`
 * (the read stops at the `null`); a key holding a source reads through it
 * and takes on its coloring (a context value `{ status: Source<Status> }`).
 */
type PathKeys<T, N, E, P extends boolean> = [T] extends [Opaque]
  ? unknown
  : T extends readonly (infer U)[]
    ? { readonly [n: number]: Path<U | N, E, P>; readonly length: Source<number | N, E, P> }
    : T extends object
      ? { readonly [K in keyof T]-?: PathThrough<T[K], N, E, P> }
      : unknown;
type Nullish<T> = [Extract<T, null | undefined>] extends [never] ? never : undefined;
type PathThrough<V, N, E, P extends boolean> = [V] extends [Source<infer U, infer E2, infer P2>]
  ? Path<U | N, E | E2, P | P2>
  : Path<V | N, E, P>;

/** A value read through: a source's value, else the value itself. */
export type ReadThrough<V> = V extends Source<infer T, any, any> ? T : V;

/** A store as blocks see it: every path is a read. */
export type TypedStore<T> = Path<T>;

// --- props ---------------------------------------------------------------------------

/**
 * Props as a block sees them (D-056, D-068): `Props<{ todo: Todo; label:
 * string }>` declares each prop and maps it to a read — `yield* props.todo`,
 * `yield* props.todo.title` — and forwarding `props.todo` to a child forwards
 * the read. A bare type is settled and never fails (D-024): its reads are
 * `Read<false, never>`. A prop that may fail or be pending declares it with
 * the one general type, `Source<T, E, P>` (`Source<Todo, FetchError, true>`):
 * its reads are `Read<P, E>`, and callers may pass anything within that
 * coloring (settled ⊂ pending, `never` ⊂ `E`). Declaring it is permission,
 * not a duty (D-040): its pending and failures reach the nearest `Loading` /
 * `Errored` wherever that is, or are re-thrown at the root (D-033, D-059).
 *
 * A component that only forwards a prop declares its color with type
 * parameters (D-029): `function* <E, P extends boolean>(props: Props<{ todo:
 * Source<Todo, E, P> }>)`; its view then carries each caller's colors.
 *
 * Every declared failure type is a `Failure` (D-034); `[FAILURE_KIND]` here
 * names the declaration that is not.
 */
export type Props<D extends PropsCheck<D>> = {
  readonly [N in keyof D]-?: PropRead<
    Exclude<D[N], undefined>,
    undefined extends D[N] ? undefined : never,
    N
  >;
} & { readonly [PROPS]?: (props: D) => D };

/** D-034 at the declaration: a prop's declared failures are `Failure`s with a literal `kind`. */
export type PropsCheck<D> = {
  [N in keyof D]: [Exclude<D[N], undefined>] extends [Source<any, infer E, any>]
    ? KindCheck<E> extends NeedsKind
      ? NeedsKind
      : unknown
    : unknown;
};

/** The read a declared prop is: a path (a source with keys), `children` a source. */
type PropRead<V, U, N> = [V] extends [Source<infer T, infer E, infer P>]
  ? N extends "children"
    ? Source<T | U, E, P>
    : Path<T | U, E, P>
  : N extends "children"
    ? Source<V | U>
    : Path<V | U>;

/**
 * What callers may pass for each prop (D-065): a value, a source or a hole
 * within its declared coloring. A bare prop takes a settled value, a settled
 * source or path, or a hole that reads only settled sources; a pending or
 * failing one is refused (`[SETTLED_PROP]`). A prop declared `Source<T, E,
 * P>` takes `T`, any source of `T` failing with part of `E` (pending too when
 * `P` is `true`), or a hole within that; with `E` / `P` type parameters (a
 * pass-through component) they are the caller's.
 */
export type PropsInput<D> = {
  [N in keyof D]: PropInput<
    Exclude<D[N], undefined>,
    undefined extends D[N] ? undefined : never,
    N
  >;
};
type PropInput<V, U, N> = [V] extends [Source<infer T, infer E, infer P>]
  ? T | U | Source<T | U, E, Widen<P>> | HoleProp<T | U, E, Widen<P>>
  : V | U | Source<V | U> | HoleProp<V | U> | SettledProp<SettledMessage<N>>;
/** A declared pending prop also takes a settled source (settled ⊂ pending). */
type Widen<P extends boolean> = [P] extends [true] ? boolean : P;
/**
 * A prop in call form may be a hole (D-065): a zero-arity `function*` the
 * child reads with `yield*` like a source — the read happens inside the
 * child, as a JSX tag's getter did (`Card({ total: function* () { return
 * (yield* n) * 2; } })`). Its colors are what it reads (and what the
 * components it calls render), so a pending hole does not pass a settled
 * prop. `children` is always one (D-066): a lazy view, `function* () {
 * return <…/>; }`, built where the child reads it.
 */
export type HoleProp<T, E = never, P extends boolean = false> = () => Generator<
  Read<P, E> | ChildView<P, E> | Raise<E>,
  T,
  any
>;
/**
 * The call-site refusal of a pending or failing value for a settled prop
 * (D-024): TypeScript prints the alias with its message, `Todo | Source<Todo>
 * | … | SettledProp<"[SETTLED_PROP] prop `todo` is settled: …">`.
 */
export type SettledProp<M extends string> = { readonly [K in M]: never };
type SettledMessage<N> =
  `[SETTLED_PROP] prop \`${N & string}\` is settled: pass a settled value, or declare it Source<T, E, true>`;

/** The props type a `Props` annotation declares. */
export type PropsOf<TP> = unknown extends TP
  ? {}
  : TP extends { readonly [PROPS]?: (props: infer D) => any }
    ? D
    : {};

/** A component's arguments: the props object, optional when every prop is. */
export type PropsArgs<D> = {} extends D ? [props?: PropsInput<D>] : [props: PropsInput<D>];

// --- views and components ---------------------------------------------------------

/**
 * What a component renders. `P` / `E` are the pending and failures it has
 * not handled; only a settled view (`View<false, never>`) is an element.
 * `yield* view` (inside another view) moves them into the enclosing view.
 * `W` is the may-wait marker (D-075): the view binds a handler that may
 * wait on pending data. It is not a color — a may-wait view is settled when
 * `P` is `false` — so it defaults to `boolean` and every annotation without
 * it accepts either.
 */
export interface View<P extends boolean = boolean, E = unknown, W extends boolean = boolean> {
  readonly [VIEW]: true;
  readonly [PENDING]: P;
  readonly [FAILS]: E;
  readonly [MAY_WAIT]: W;
  [Symbol.iterator](): Generator<ChildView<P, E, W>, SettledView, any>;
}
export type SettledView = View<false, never>;

/**
 * What calling a block component returns: its view, marked as a component's
 * — a JSX tag refuses a function returning one (D-067), and the mark sits on
 * the view, not the function, so a component stays a plain function type.
 */
export type ComponentView<
  P extends boolean = boolean,
  E = unknown,
  W extends boolean = boolean
> = View<P, E, W> & {
  readonly [COMPONENT]: true;
};

/**
 * A component built by `$component`: calling it renders it and returns its
 * view. A plain function type, so a component whose props are generic in
 * their colors (D-029) keeps its type parameters (D-068).
 */
export type Component<
  D = {},
  Pd extends boolean = boolean,
  E = unknown,
  W extends boolean = boolean
> = (...props: PropsArgs<D>) => ComponentView<Pd, E, W>;

/** A view generator's pending: its reads' and, for a no-JSX view, its output's. */
export type ViewPending<VY, R> = PendingOf<VY | HOps<R>>;
export type ViewFails<VY, R> = FailsOf<VY | HOps<R>>;
/** A view generator's may-wait marker (D-075): its binds' and its children's. */
export type ViewMayWait<VY, R> = MayWaitOf<VY | HOps<R>>;
/**
 * The colors of what a view returns: `h` output's, or a flow control's view
 * (an `h` view may return `Show({ … })` itself). A JSX element is settled.
 */
export type HOps<R> =
  R extends HView<infer P, infer E, infer W>
    ? ChildView<P, E, W>
    : R extends View<infer P, infer E, infer W>
      ? ChildView<P, E, W>
      : never;

/**
 * Output of the no-JSX renderer (`h`): its pending / failures are
 * the union of its holes', and so is its may-wait marker (`W`, D-075).
 */
export interface HView<P extends boolean = boolean, E = unknown, W extends boolean = boolean> {
  readonly [HVIEW]: true;
  readonly [PENDING]: P;
  readonly [FAILS]: E;
  readonly [MAY_WAIT]: W;
}

// --- events ----------------------------------------------------------------------------

/**
 * A call of an `$event` handler: it has started (a handler runs when it is
 * called, as a DOM dispatch needs), and it is a promise of the body's result.
 * In block code it is an operation: `yield* save(x)` waits for it — its
 * result, or its failure thrown at the `yield*` — and carries its colors into
 * the caller's type.
 */
export interface EventCall<
  R = unknown,
  E = never,
  P extends boolean = boolean,
  A extends boolean = boolean
>
  extends Promise<R | undefined>, Yieldable<EventCallOp<P, A, E>, R> {
  readonly [EVENT_CALL]: true;
}

/**
 * An `$event` handler, a Solid action: call it with the arguments its body
 * takes (an event, or anything else). Its colors: `P`, it reads pending data
 * (and waits for it); `A`, it does async work of its own.
 *
 * Two operations take it. `yield* save(x)` calls it (an `EventCallOp`: the
 * caller waits, and gets the call's colors). `yield* save` binds it (D-072):
 * in a view's event attribute, `onClick={yield* save}` is a `Bind` op that
 * gives the view the handler's failures and, from its `P`, the may-wait
 * marker (not pending, D-075), and evaluates to the handler itself, branded
 * `BoundEvent` — the one value an event attribute takes.
 */
export interface EventHandler<
  Args extends unknown[] = any[],
  E = never,
  R = unknown,
  P extends boolean = boolean,
  A extends boolean = boolean
> {
  (...args: Args): EventCall<R, E, P, A>;
  readonly [EVENT]: true;
  readonly [FAILS]?: E;
  /** Phantom: a call may wait on pending data (its `P`; the lint's `no-unshown-wait` reads it). */
  readonly [MAY_WAIT]?: P;
  [Symbol.iterator](): Generator<Bind<P, E>, BoundEvent<Args>, any>;
}

/**
 * An `$event` handler bound in a view (`yield* save`, D-072): what an event
 * attribute of the blocks JSX namespace takes. At run time it is the handler
 * itself; the brand says a `Bind` op put its colors in the view's type.
 */
export interface BoundEvent<Args extends unknown[] = any[]> {
  (...args: Args): unknown;
  readonly [BOUND]: true;
}
/** A DOM handler type `H` as an event attribute takes it: bound in a view (D-072). */
export type Bound<H> = H & { readonly [BOUND]: true };

/** Setter of a `$signal`: writes when called; `yield*` on the receipt is the new value. */
export type BlockSetter<T> = <U extends T>(value: U | ((prev: T) => U)) => Receipt<U>;
/** Setter of a `$store`. */
export type BlockStoreSetter<T> = (fn: (draft: T) => T | void) => Receipt<T>;
/** A write receipt. */
export interface Receipt<T> extends Yieldable<Write, T> {}

// --- row blocks ----------------------------------------------------------------------

/**
 * What `view(function* () { … })` returns (D-089): the view function, with a
 * phantom brand whose name is the refusal. A setup — a component's or a
 * row's — returns its view through `view(…)`, so a bare `function*` returned
 * there lacks the brand, and TypeScript reports the missing property by its
 * name: "wrap the view: return view(function* () { … })". Nothing exists at
 * run time (`view` is the identity).
 */
export type ViewFn<Y, R> = (() => Generator<Y, R, any>) & ViewWrapped;
export interface ViewWrapped {
  readonly "[VIEW_WRAPPER] wrap the view: return view(function* () { ... })": true;
}

/**
 * A render callback written as a block: its setup takes the flow control's
 * render arguments and creates, and returns its view, which only reads.
 * A flow control renders settled rows only.
 */
export type RowBlock<A extends readonly unknown[], Y, VY, R = unknown> = ((
  ...args: A
) => Generator<Y, ViewFn<VY, R>, any>) &
  RowCheck<Y, VY, R>;

type RowCheck<Y, VY, R> = [Y] extends [SetupOp]
  ? [VY] extends [[R] extends [HView<any, any>] ? HViewOp : ViewOp]
    ? unknown
    : {
        readonly "[ROW_VIEW_OP] a row block's view only reads: create state in its setup": never;
      }
  : {
      readonly "[ROW_SETUP_OP] a row block's setup only creates: read in its view": never;
    };

/**
 * A row need not be settled (D-059, D-063): its pending and failures join the
 * flow control's output, and so the view holding it (`{yield* For({ … })}`),
 * and reach the nearest `Loading` / `Errored` above the list.
 */
export type RowPending<VY, R> = ViewPending<VY, R>;
/** A row's failures: its view's, and its setup's effects' (`Y`, D-073). */
export type RowFails<VY, R, Y = never> = ViewFails<VY, R> | FailsOf<Y>;

export type ErrorClass<E = unknown> = abstract new (...args: any[]) => E;

/**
 * What a block may fail with (D-034): an `Error` with a literal `kind`.
 * Failures are removed from a type structurally (TypeScript compares shapes)
 * but matched at run time with `instanceof`, so two error classes with the
 * same shape would be one type: the literal `kind` tells them apart. Every
 * entry point of a failure type checks it — `attempt`, `until`, `raise`,
 * `Errored`'s `catch`.
 */
export type Failure = Error & { readonly kind: string };
/** The branded refusal of an error type without a literal `kind`. */
export interface NeedsKind {
  readonly '[FAILURE_KIND] an error class needs `readonly kind = "x" as const` so its failure can be told apart': never;
}
/** `unknown` when every member of `E` is a `Failure` with a literal `kind`; else `NeedsKind`. */
export type KindCheck<E> = [E] extends [never]
  ? unknown
  : [KindBits<E>] extends [never]
    ? unknown
    : NeedsKind;
type KindBits<E> = E extends Error & { readonly kind: infer K }
  ? string extends K
    ? true
    : never
  : true;
