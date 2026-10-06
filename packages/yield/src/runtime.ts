/*
 * The routine runtime: an interpreter for yield components on Solid's public API.
 *
 * Nothing here is compiled. Every operation a routine delegates to with
 * `yield*` runs inside its own iterator and returns its result without
 * yielding, so `yield* count` is a plain tracked call of `count` in whatever
 * computation is running the routine. The only operation that yields to a
 * driver is an async `attempt`: the memo / event runner suspends the
 * generator on its promise and resumes it when the promise settles.
 *
 * Views: after the JSX transform's one yield rule (`yield* e` inside JSX
 * becomes `perform(e)`), a view generator has no `yield` left and runs once;
 * each hole is its own computation. A view has no body (D-032): a read at its
 * top level — outside a JSX position or a hole — is the development error
 * `READ_IN_VIEW`.
 */
import {
  action,
  createMemo,
  createOptimistic,
  createOptimisticStore,
  createProjection,
  refresh as solidRefresh,
  until as solidUntil,
  createRenderEffect,
  createSignal,
  createStore,
  createEffect,
  getObserver,
  getOwner,
  isPending as solidIsPending,
  latest as solidLatest,
  NotReadyError,
  onCleanup,
  runWithOwner,
  untrack,
  useContext,
  createContext as solidCreateContext,
  type Accessor,
  type MemoOptions,
  type ProjectionOptions,
  type SignalOptions,
  type Store
} from "solid-js";
import type {
  Handled,
  StreamAttempt,
  WaitsOf,
  ReadsPendingOf,
  Write,
  ChildView,
  HView,
  Setter,
  StoreSetter,
  Cleanup,
  ComponentView,
  Create,
  ComputeOp,
  EffectPhaseOp,
  ErrorClass,
  EventCall,
  EventCallOp,
  EventHandler,
  KindCheck,
  EventOp,
  FailsOf,
  HoleOp,
  MemoOp,
  Path,
  PendingOf,
  PropsArgs,
  HoleCall,
  PropsOf,
  Raise,
  Read,
  Receipt as ReceiptType,
  SetupOp,
  Source,
  TypedStore,
  ViewFails,
  ViewOp,
  ViewPending,
  ViewMayWait,
  ViewRequires,
  RequiresOf,
  ViewFn,
  ViewWrapped,
  Wait,
  Yieldable
} from "./types.js";

declare const __DEV__: boolean;
declare const __SERVER__: boolean;

// --- runtime marks -----------------------------------------------------------------

/** The read a readable performs: `x[READ]()` (or `PATH` for a path reader). */
export const READ: unique symbol = Symbol.for("solid.yield.read") as any;
/** Marks a component's view value (so `perform` returns it unread). */
export const VIEW_MARK: unique symbol = Symbol.for("solid.yield.view") as any;
/** Marks `component` functions. */
export const COMPONENT_MARK: unique symbol = Symbol.for("solid.yield.component") as any;
/**
 * Marks `solid-yield/h` output (and so the automatic `jsx()` runtime's,
 * built on it): an element thunk, built where it is inserted. The library's
 * own mark, so `render` and the boundaries recognise it with no reach into
 * `@solidjs/h` (D-004, D-095).
 */
export const ELEMENT_MARK: unique symbol = Symbol.for("solid.yield.element") as any;
/** Marks `$event` handlers (`perform` binds one: returns it unread and uncalled, D-072). */
export const EVENT_MARK: unique symbol = Symbol.for("solid.yield.event") as any;
/** Marks a call of an `$event` handler (an `attempt` over one delegates to it, D-077). */
const EVENT_CALL_MARK: unique symbol = Symbol.for("solid.yield.event-call") as any;
const OP: unique symbol = Symbol.for("solid.yield.op") as any;
const PATH_TARGET: unique symbol = Symbol.for("solid.yield.path") as any;
const PATH_READ = 1;

/**
 * Every build (D-087): the brand of a typed failure — `raise`'s error, and the
 * `Error` an `attempt`'s handler returns. One non-enumerable symbol on the
 * object already being thrown. An `attempt` over an event call hands its
 * handler only a branded failure; anything else the call rejects with is a
 * crash (D-019) and goes past the handler.
 */
const FAILURE: unique symbol = Symbol.for("solid.yield.failure") as any;
const TYPED_FAILURES = new WeakSet<object>();
function brand<T>(e: T): T {
  if (e !== null && (typeof e === "object" || typeof e === "function"))
    TYPED_FAILURES.add(e as object);
  if (
    e !== null &&
    (typeof e === "object" || typeof e === "function") &&
    (e as any)[FAILURE] !== true &&
    Object.isExtensible(e)
  )
    Object.defineProperty(e, FAILURE, { value: true, enumerable: false, configurable: true });
  return known(e);
}
/** Brand a failure the runtime routes (D-087): `lazy`'s `ChunkError` (D-100). */
export const brandFailure: <T>(e: T) => T = brand;
/** A typed failure (D-087): branded by `raise` or an attempt's handler, in every build. */
function isFailure(e: unknown): boolean {
  return (
    e != null &&
    (typeof e === "object" || typeof e === "function") &&
    (TYPED_FAILURES.has(e as object) || (e as any)[FAILURE] === true)
  );
}

/**
 * Dev only: what a routine may throw without it being a bug, so is not
 * decorated as `UNTYPED_THROW` — a typed failure (branded, above), the
 * library's own dev errors, and a plain throw already reported (so nested
 * runs never wrap it twice). `NotReadyError` is pending, not a failure, and
 * is never wrapped. Solid hands a failure on wrapped (its internal status
 * error, the original as `cause`): the `cause` chain is followed.
 */
const KNOWN = new WeakSet<object>();
function known<T>(e: T): T {
  if (__DEV__ && e !== null && (typeof e === "object" || typeof e === "function"))
    KNOWN.add(e as object);
  return e;
}

function isKnown(e: unknown): boolean {
  let x: any = e;
  for (let i = 0; i < 8 && x !== null && (typeof x === "object" || typeof x === "function"); i++) {
    if (KNOWN.has(x) || isFailure(x)) return true;
    x = x.cause;
  }
  return false;
}

// --- one runtime per app -------------------------------------------------------------

/**
 * @internal Where this copy of the runtime registers itself in development:
 * one key per build (a server render and a client hydrating in one test
 * process are two runtimes by design).
 */
export const INSTANCE: unique symbol = Symbol.for(
  __SERVER__ ? "solid.yield.instance.server" : "solid.yield.instance.client"
) as any;

/**
 * @internal Dev only: a second copy of the runtime (a duplicated dependency,
 * a bundle that inlined the package next to an external one) is an error.
 * The marks are `Symbol.for` keys, so two copies half-work together — each
 * keeps its own host state, and a routine driven by one copy fails the other's
 * checks with misleading errors. The same module evaluated again (a re-import
 * at the same URL) replaces its registration.
 */
export function registerInstance(url: string | undefined): void {
  const g = globalThis as any;
  const prev: { url: string | undefined } | undefined = g[INSTANCE];
  if (prev && (prev.url === undefined || url === undefined || prev.url !== url))
    throw devError(
      "DUPLICATE_RUNTIME",
      `two copies of solid-yield are loaded: ${prev.url ?? "(unknown URL)"} and ${url ?? "(unknown URL)"}. ` +
        "An app holds one runtime: dedupe the dependency (one version, one install), and keep the package external in bundles."
    );
  g[INSTANCE] = { url };
}
if (__DEV__) registerInstance(import.meta.url);

// --- hosts ---------------------------------------------------------------------------

const NONE = 0;
const SETUP = 1;
const VIEW = 2;
const MEMO = 3;
const EFFECT = 4;
const EVENT = 5;
const HOLE = 6;
/** An `$effect`'s compute (D-079): tracked reads, no writes. (`EFFECT` is its effect phase.) */
const COMPUTE = 7;
type Host = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const HOST_NAMES = [
  "plain code",
  "a setup",
  "a view",
  "a memo",
  "an effect",
  "an event",
  "a hole",
  "an effect's compute"
];

/**
 * What the running routine is. One value, replaced whole by `runAs` for each
 * run and restored after it, so a run started inside another (a view built
 * while a memo resumes, a child's setup inside a parent's view, a hole's
 * first pass) starts from its own state and leaves the outer one as it was.
 */
interface HostState {
  readonly host: Host;
  /** Cleanups of the running effect run (null outside an effect). */
  readonly sink: (() => void)[] | null;
  /** Set while a memo runs after its first async `attempt`. */
  readonly resumed: boolean;
  /**
   * Dev only: the name of the component (or row) whose view is running at
   * its top level — not in a hole, not in a child's setup — or null. A read
   * then is `READ_IN_VIEW`.
   */
  readonly view: string | null;
  /** Dev only: a read from a JSX position (`perform`) is in progress, paths and getters included. */
  readonly jsx: boolean;
  /** Dev only: the component (or row) the running routine belongs to, for dev errors. */
  readonly name: string | null;
  /**
   * Dev only: the receipts setters returned in this run (an `$event` call's
   * steps share one list), each to be delegated to before the run ends.
   */
  readonly receipts: Receipt<unknown>[] | null;
  /**
   * Dev only: the observer the run started under — the hole a component was
   * called in, or none. A setup and a view run under whatever computation
   * called the component (D-097: no untrack), so a read whose observer is this
   * one is the run's own; a read under another observer belongs to a
   * computation the run created, running its first pass.
   */
  readonly observer: unknown;
}
let state: HostState = {
  host: NONE,
  sink: null,
  resumed: false,
  view: null,
  jsx: false,
  name: null,
  receipts: null,
  observer: null
};

/**
 * Run `run` as `host`, with a state of its own: every place the runtime
 * drives routine code (a setup, a view, a hole, a memo's run and resumption,
 * an effect run, an event's steps) goes through here. In
 * development a plain throw out of the run is `UNTYPED_THROW` (D-019).
 */
function runAs<T>(
  host: Host,
  run: () => T,
  sink: (() => void)[] | null = null,
  view: string | null = null,
  jsx = false,
  resumed = false,
  name: string | null = null,
  receipts: Receipt<unknown>[] | null = null
): T {
  const prev = state;
  // a run checks the receipts it minted when it ends (an `$event` call
  // hands its own list to every step and checks it when the body ends)
  const own = __DEV__ && receipts === null ? [] : null;
  state = {
    host,
    sink,
    resumed,
    view,
    jsx,
    name,
    receipts: receipts ?? own,
    observer: __DEV__ ? getObserver() : null
  };
  try {
    const result = run();
    if (own !== null && own.length) checkReceipts(own, host, name);
    return result;
  } catch (e) {
    if (__DEV__) throw untyped(e, host, name);
    throw e;
  } finally {
    state = prev;
  }
}

/**
 * Dev only: a plain throw out of a routine (D-019) — not a typed failure,
 * so a bug: re-thrown as `UNTYPED_THROW` naming the host and the component,
 * with the original as its `cause`. It still goes to the nearest `Errored`,
 * or with none it is re-thrown (D-033); production re-throws the original.
 */
function untyped(e: unknown, host: Host, name: string | null): unknown {
  if (e instanceof NotReadyError) return e;
  if (isKnown(e)) return e;
  const message = e instanceof Error ? e.message : String(e);
  return known(
    new Error(
      `[UNTYPED_THROW] ${HOST_NAMES[host]} in <${name ?? "anonymous"}>: ${message} — a routine fails with yield* raise(error) or through an attempt's handler; a plain throw is a bug.`,
      { cause: e }
    )
  );
}

/** @internal A development error of this library (`[CODE] message`). */
export function devError(code: string, message: string): Error {
  return known(new Error(`[${code}] ${message}`));
}

function checkRead(inJsx: boolean): void {
  // A setup never reads (D-042). A read under the observer the setup started
  // under is the setup's own; under another, it belongs to a plain Solid
  // computation the setup created (a `dynamic`, a derived store) running its
  // first pass: that read is the computation's. A read from a JSX position
  // is never the setup's (see `perform`).
  const { host, view, observer } = state;
  if (!inJsx && host === SETUP && getObserver() === observer)
    throw devError(
      "READ_IN_SETUP",
      "a setup creates; it does not read. Read in the view's holes, a $memo, an $effect or an $event (an $event and an $effect's effect phase read untracked)."
    );
  // The same for a view's top level: a computation the view's run created
  // (a flow control reading its props, a hole's first pass) reads for itself.
  if (!inJsx && view !== null && host === VIEW && getObserver() === observer)
    throw devError(
      "READ_IN_VIEW",
      `<${view}>: read outside a JSX position. A view has no body: read in a hole ({yield* …} in JSX, a bare function* in h), branch with a flow control (Show(…) / Match(…) in a hole), derive with a $memo in the setup.`
    );
  if (state.resumed)
    throw devError(
      "READ_AFTER_ATTEMPT",
      "a $memo reads before its first async attempt: a read after it would not be tracked."
    );
}

// --- reading ------------------------------------------------------------------------

/**
 * Perform the read a readable stands for (tracked in the running computation).
 * `jsxRead`: the read comes from a JSX position (`perform`, which the transform
 * writes for a `yield*` inside JSX) — a hole, or a prop getter that whoever
 * receives the prop reads. It is never the running view's or setup's own
 * top-level read, even when it happens while one is on the stack: plain
 * Solid code may read a prop getter untracked right then (a `<Reveal>`
 * registering a nested `<Loading>` reads its `order` while the nested
 * card's view is being built), and that read must not fail as a view's or
 * a setup's read.
 */
function readOf(x: any): unknown {
  if (__DEV__) checkRead(state.jsx);
  const r = x[READ];
  return r === PATH_READ ? readPath(x[PATH_TARGET]) : r.call(x);
}

/** A value read through: a readable's value, else the value itself. */
export function through(v: any): any {
  return v != null && v[READ] !== undefined ? readOf(v) : v;
}

function* sourceIterator(this: any): Generator<unknown, unknown, unknown> {
  return state.host === EVENT ? yield* eventRead(this) : readOf(this);
}

/**
 * A read in an event: an event takes current values, and when the source has
 * none yet (pending) the event waits until it can be read — the reading event's
 * `P` color.
 */
function* eventRead(x: any): Generator<unknown, unknown, unknown> {
  try {
    return readOf(x);
  } catch (e) {
    if (!(e instanceof NotReadyError)) throw e;
    // The value comes from the wait itself: when the source's first value
    // lands inside this event's own transaction, a second (untracked) read
    // here could not see it until the transaction commits — after the event.
    const box = (yield new Wait_(solidUntil(() => ({ value: readOf(x) })))) as { value: unknown };
    return box.value;
  }
}

/** Turn an accessor this library created into a source (iterable, readable). */
function asSource<T>(get: Accessor<T>): Source<T, any, any> {
  (get as any)[READ] = get;
  (get as any)[Symbol.iterator] = sourceIterator;
  return get as any;
}

/**
 * @internal A source over a getter (a prop Solid's `h` turned into one: a
 * provider's `value` given as a source or a hole, D-098).
 */
export function getterSource<T>(get: () => T): Source<T, any, any> {
  return asSource(get);
}

/**
 * `constant(value)`: a source that always reads `value` — settled, never
 * failing, never changing (D-060). Usable anywhere, module level included (a
 * constant needs no owner): `createContext(constant<Identity | null>(null))`
 * is a context of sources whose default is the constant.
 */
export function constant<T>(value: T): Source<T> {
  return asSource(() => value) as any;
}

/**
 * `yield* latestOf(results)`: the latest value of a source — while a newer
 * one is pending, the previous one (Solid's `latest`: stale while
 * revalidating). Pending only until a first value exists.
 */
export function latestOf<T, E, P extends boolean>(source: Source<T, E, P>): Source<T, E, P> {
  const get = accessor(source);
  return asSource(() => solidLatest(get)) as any;
}

/**
 * `yield* isPendingOf(results)`: whether a source has a newer value in
 * flight (Solid's `isPending`). Never pending itself.
 */
export function isPendingOf(source: Source<unknown, unknown, boolean>): Source<boolean> {
  const get = accessor(source);
  return asSource(() => solidIsPending(get)) as any;
}

/**
 * @internal A plain accessor for a source, for the library's own hand-offs to
 * Solid (holes, `latestOf`, `until`). Not exported: routine code reads with `yield*`.
 */
export function accessor<T>(source: Source<T, any, boolean>): Accessor<T> {
  return typeof source === "function" ? (source as any) : () => readOf(source) as T;
}

/**
 * The call form of `yield*` in a view hole: the JSX transform turns
 * `{(yield* user).name}` into `{perform(user).name}`, so the read happens in
 * the hole's own computation. Also reads a foreign accessor. An `$event`
 * handler in an event attribute (`onClick={yield* save}`) is bound (D-072):
 * a wrapper for the DOM to call, which routes a failure nobody handles to the
 * bind site's `Errored` (D-085).
 */
export function perform<T>(target: Yieldable<any, T> | (() => T) | T): T {
  const x = target as any;
  // D-041: JSX only in a view, a hole or a row's view; a hole performed
  // while a setup runs is JSX built in the setup
  if (__DEV__ && state.host === SETUP)
    throw devError(
      "JSX_IN_SETUP",
      `<${state.name ?? "anonymous"}>: JSX in a setup. A setup creates state; elements are built by the view it returns (return view(function* () { return <…/>; })).`
    );
  if (x != null) {
    if (x[READ] !== undefined) {
      if (!__DEV__) return readOf(x) as T;
      const { host, sink, view, resumed, name, receipts } = state;
      return runAs(host, () => readOf(x) as T, sink, view, true, resumed, name, receipts);
    }
    // A view that is a function (a flow control's, a lazy component's) is
    // content. On the server it goes back in a one-element array: Solid's
    // server hole calls a function it returns inside the hole, so a pending
    // read in the view made the hole the retry unit, and the retry re-ran the
    // call that created it — a page set up twice, its memos run again
    // (rendering-yield's streamed `/profile`). As an array element the view
    // is resolved, and retried, as itself. The client inserts it as it is.
    if (x[VIEW_MARK] === true) return (__SERVER__ ? [x] : x) as T;
    if (x[EVENT_MARK] === true) return bindEvent(x);
    if (typeof x === "function") return x();
    // A routine operation (an attempt, a raise, a context, an event call, …)
    // is an object whose iterator is a generator. Being iterable is not
    // enough: a `<form>` or a `<select>` has an indexed getter, so WebIDL
    // makes it iterable over its controls — a component whose view's root is
    // one, called in a hole, was driven as a routine (`NOT_AN_OPERATION` on
    // its first control). Any other iterable is content, passed on as it is.
    if (typeof x === "object" && !Array.isArray(x) && typeof x[Symbol.iterator] === "function") {
      if (typeof Node !== "undefined" && x instanceof Node) return x as T;
      const it = x[Symbol.iterator]();
      if (!isGeneratorObject(it)) return x as T;
      return runAs(HOLE, () => drive(it, HOLE_RUN), null, null, false, false, state.name) as T;
    }
  }
  return x;
}

// --- paths (props, stores) -------------------------------------------------------------

interface PathTarget {
  root: any;
  getter: boolean;
  path: PropertyKey[];
}
/** Node's `util.inspect` hook (`console.log(path)` in Node, test failure output). */
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/** A readable description of a path: `[path .user.name]`, `[path .items[0]]`. */
function describePath(t: PathTarget): string {
  let keys = "";
  for (const key of t.path)
    keys +=
      typeof key === "symbol"
        ? `[${String(key)}]`
        : /^\d+$/.test(String(key))
          ? `[${String(key)}]`
          : `.${String(key)}`;
  return `[path ${keys || "(root)"}]`;
}

/**
 * A path is a read, not an object: enumerating it, describing its keys,
 * defining or deleting one would see the proxy's own fields (or nothing),
 * never the data. In development each is `PATH_OBJECT`; in production the
 * path shows no keys and refuses the change.
 */
function pathObject(what: string): never {
  throw devError(
    "PATH_OBJECT",
    `a path is a read, not an object (${what}): read it with yield* and use the value.`
  );
}

const pathHandler: ProxyHandler<PathTarget> = {
  get(t, key) {
    if (key === READ) return PATH_READ;
    if (key === PATH_TARGET) return t;
    if (key === Symbol.iterator) return sourceIterator;
    // printed or coerced (a template literal, String(path), JSON, a log),
    // a path describes itself instead of failing to convert
    if (key === Symbol.toPrimitive || key === INSPECT) return () => describePath(t);
    if (key === "toString" || key === "toJSON") return () => describePath(t);
    if (typeof key === "symbol" || key === "then") return undefined;
    return makePath(t.root, t.getter, t.path.length ? [...t.path, key] : [key]);
  },
  has(t, key) {
    return key === READ || key === Symbol.iterator;
  },
  set() {
    throw devError("PATH_WRITE", "a path reads; write through the setter.");
  },
  ownKeys() {
    if (__DEV__) pathObject("its keys were listed: a spread, Object.keys, a for…in");
    return [];
  },
  getOwnPropertyDescriptor(_t, key) {
    if (__DEV__) pathObject(`a descriptor of ${String(key)} was asked for`);
    return undefined;
  },
  defineProperty(_t, key) {
    if (__DEV__) pathObject(`${String(key)} was defined on it`);
    return false;
  },
  deleteProperty(_t, key) {
    if (__DEV__) pathObject(`${String(key)} was deleted from it`);
    return false;
  }
};
function makePath(root: any, getter: boolean, path: PropertyKey[]): any {
  return new Proxy({ root, getter, path } as PathTarget, pathHandler);
}
function readPath(t: PathTarget): unknown {
  let v = t.getter ? t.root() : t.root;
  const path = t.path;
  for (let i = 0; i < path.length; i++) {
    v = throughHole(v);
    if (v == null) return undefined;
    v = v[path[i] as any];
  }
  // a prop given as a hole (D-065) or a lazy view (`children`, D-066) is
  // run here, in the reading computation, as a JSX tag's getter was
  return throughHole(v);
}

/** Props as reads: `props.x` is a path reader over the raw props. */
function typedProps(raw: any): any {
  return new Proxy(raw, {
    get(target, key) {
      if (typeof key === "symbol") return target[key];
      return makePath(target, false, [key]);
    }
  });
}

/** A reader over a render argument (a row's item, a branch's value). */
export function rowArg(value: unknown, isAccessor: boolean): any {
  return makePath(value, isAccessor, []);
}

class Selection {
  constructor(
    readonly store: any,
    readonly select: (state: any) => unknown
  ) {}
  [READ](): unknown {
    const s = this.store;
    return this.select(s != null && s[PATH_TARGET] ? readPath(s[PATH_TARGET]) : s);
  }
  *[Symbol.iterator](): Generator<unknown, unknown, unknown> {
    return state.host === EVENT ? yield* eventRead(this) : readOf(this);
  }
}
/**
 * `yield* readStore(todos, t => t.filter(x => x.completed).length)`: one
 * tracked read of whatever the selector touches (a structural read that is
 * not one path).
 */
export function readStore<T, E, P extends boolean, R>(
  store: Source<T, E, P>,
  select: (state: T) => R
): Source<R, E, P>;
export function readStore(store: unknown, select: (state: any) => unknown): unknown {
  return new Selection(store, select);
}

// --- driving ----------------------------------------------------------------------------

const HOLE_RUN = 0;
const SYNC_RUN = 1;
interface WaitOp {
  readonly [OP]: "wait";
  readonly promise: PromiseLike<unknown>;
}
function isWait(op: any): op is WaitOp {
  return op != null && op[OP] === "wait";
}

/** Run a generator that must not suspend. */
function drive(it: Iterator<unknown>, _mode: number): unknown {
  const r = it.next();
  if (r.done) return r.value;
  if (typeof it.return === "function") it.return(undefined);
  throw isWait(r.value)
    ? devError(
        "ASYNC_NOT_ALLOWED",
        `an async attempt suspends; only a $memo or an $event may wait (this is ${HOST_NAMES[state.host]}).`
      )
    : devError(
        "NOT_AN_OPERATION",
        `a routine delegated to something that is not a routine operation (\`yield*\` a source, a store path, a prop, attempt, raise or a setter receipt). It received: ${describeYielded(r.value)}. A \`yield*\` of an iterable that is not an operation (an array, a Set, a <form> or <select> element) delegates to its items.`
      );
}

/** What a routine yielded, for `NOT_AN_OPERATION`: its constructor's name, or its type. */
function describeYielded(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === "function") return `a function${v.name ? ` ${v.name}` : ""}`;
  if (typeof v !== "object") return `${typeof v} ${String(v)}`;
  return (v as any).constructor?.name || "an object with no constructor";
}

// --- operations ------------------------------------------------------------------------

class Wait_ implements WaitOp {
  readonly [OP] = "wait" as const;
  constructor(readonly promise: PromiseLike<unknown>) {}
}
function isThenable(v: any): v is PromiseLike<unknown> {
  return v != null && typeof v.then === "function";
}

class Attempt {
  constructor(
    readonly run: () => unknown,
    readonly onError: (error: unknown) => unknown
  ) {}
  *[Symbol.iterator](): Generator<unknown, unknown, unknown> {
    let v: unknown;
    try {
      v = this.run();
    } catch (e) {
      if (e instanceof NotReadyError) throw e;
      return yield* handle(this.onError, e);
    }
    // an event call (D-077): delegated to as `yield* call` is — at once when
    // its body already finished (so an `$effect` may attempt a synchronous
    // one), else waiting for it — and its typed failure goes through the
    // handler. Anything else it rejects with is a crash, not a failure
    // (D-019, D-087): it goes past the handler, `UNTYPED_THROW` in
    // development, as itself in production.
    if (v != null && (v as any)[EVENT_CALL_MARK] === true) {
      let failed = false;
      let error: unknown;
      try {
        return yield* (v as any)[Symbol.iterator]();
      } catch (e) {
        if (e instanceof NotReadyError || !isFailure(e)) throw e;
        failed = true;
        error = e;
      }
      if (failed) return yield* handle(this.onError, error);
    }
    if (isThenable(v)) {
      let failed = false;
      let error: unknown;
      try {
        v = yield new Wait_(v);
      } catch (e) {
        failed = true;
        error = e;
      }
      // on rejection: inside the event's transaction, or as the memo's
      // resumption — the attempt's own host runs the handler (D-078)
      if (failed) return yield* handle(this.onError, error);
    }
    // a stream (or a promise's stream) is not waited for. An event does not
    // attempt one (D-091): it does one thing and finishes; a $memo holds what
    // keeps arriving. Its failures go through the handler as they come, after
    // the host's run, so the handler is a plain function — an `Error` fails the
    // stream, nothing ends it — run as the attempt's host ran
    const { host, name } = state;
    if (__DEV__ && host === EVENT && isStream(v))
      throw devError(
        "STREAM_IN_EVENT",
        "an $event does not attempt a stream: a stream is consumed in a reactive routine — $memo or $projection (`return yield* attempt(() => watch(feed), onError)`)."
      );
    return mapStream(v, e =>
      runAs(
        host,
        () => {
          const r = this.onError(e);
          if (isGeneratorObject(r)) {
            r.return(undefined);
            throw devError(
              "STREAM_HANDLER",
              "a stream's failures arrive after the host's run, so its attempt's handler is a plain function: return an Error (the stream fails) or nothing (the stream ends), not a generator."
            );
          }
          return r;
        },
        null,
        null,
        false,
        true,
        name
      )
    );
  }
}
/** An async iterable: what an attempt gives back as a stream. */
function isStream(v: any): boolean {
  return (
    v != null &&
    (typeof v === "object" || typeof v === "function") &&
    typeof v[Symbol.asyncIterator] === "function"
  );
}
/**
 * A generator object (what a `function*` returns), not any iterable: it has
 * `next`, `throw` and `return`. An iterable's iterator (an array's, a DOM
 * collection's, a `<form>`'s) has `next` alone; `Symbol.iterator` says
 * nothing (every iterable has one).
 */
function isGeneratorObject(r: any): r is Generator<unknown, unknown, unknown> {
  return (
    r != null &&
    typeof r === "object" &&
    typeof r.next === "function" &&
    typeof r.throw === "function" &&
    typeof r.return === "function"
  );
}
/**
 * Run an attempt's handler on a failure (D-078). One handler, decided by its
 * result: a generator is routine code, delegated to as part of the attempt —
 * its ops are the host's (a write inside an event's transaction, a nested
 * attempt), and `yield* raise(e)` in it fails the attempt with `e`. Then the
 * return decides: an `Error` is the failure the attempt fails with (the
 * only way a failure leaves the handler); anything else — nothing, or a
 * value — absorbs it, and the attempt gives that value.
 */
function* handle(
  onError: (error: unknown) => unknown,
  error: unknown
): Generator<unknown, unknown, unknown> {
  const r = onError(error);
  const out = isGeneratorObject(r) ? yield* r : r;
  if (out instanceof Error) throw brand(out);
  return out;
}
/** For a stream's failure, outside the attempt's run: an `Error` fails the stream, anything else ends it. */
function handled(r: unknown): unknown {
  if (r instanceof Error) throw brand(r);
  return r;
}
/**
 * What waiting on `fn`'s result is: an event call's colors (its failures go
 * through the handler, D-077), a promise's wait, or nothing.
 */
type AttemptWait<T> =
  T extends EventCall<any, any, infer P, infer A>
    ? EventCallOp<P, A, never>
    : T extends PromiseLike<any>
      ? Wait
      : never;
/** Whether `fn`'s result is a stream (or a promise of one): an attempt gives it back (D-091). */
type IsStream<T> =
  T extends EventCall<any, any, any, any>
    ? false
    : [Awaited<T>] extends [never]
      ? false
      : Awaited<T> extends AsyncIterable<any>
        ? true
        : false;
/** A stream given back is a `StreamAttempt`: reactive routines take it, an `$event` does not (D-091). */
type AttemptStream<T> =
  true extends IsStream<T>
    ? StreamAttempt & {
        readonly "[STREAM_IN_EVENT] a stream is consumed in a reactive routine: $memo or $projection": true;
      }
    : never;
/**
 * What the handler receives: an event call's typed failures, exactly (D-077,
 * D-087: the runtime passes only branded failures; a crash goes past the
 * handler), else anything caught.
 */
type Caught<T> = T extends EventCall<any, infer E, any, any> ? E : unknown;
/** What a handler's run yields: a generator handler's ops, which are the host's (D-078). */
type HandlerYields<H> = H extends Generator<infer Y, any, any> ? Y : never;
/** What a handler's run returns: a generator handler's return, else the handler's own. */
type HandlerReturn<H> = H extends Generator<any, infer R, any> ? R : H;
/** A handler whose return is an `Error`: the attempt fails with it (a transform). */
type Fails<R> = [R] extends [Error] ? true : false;
/**
 * What the attempt yields: what waiting on `fn`'s result is, the generator
 * handler's ops (its colors join the host's), and the returned failure.
 */
type AttemptOps<T, H> =
  | AttemptWait<T>
  | AttemptStream<T>
  | HandlerYields<H>
  | (Fails<HandlerReturn<H>> extends true ? Raise<HandlerReturn<H>> : never);
/** Absorbed: nothing gives `undefined`, a value `V` itself. */
type Absorbed<R> = R extends void ? undefined : R;
/** What an attempt gives: absorbed, the handler's value too (`T | undefined`, `T | V`). */
type AttemptResult<T, H> =
  Fails<HandlerReturn<H>> extends true ? Attempted<T> : Attempted<T> | Absorbed<HandlerReturn<H>>;
/**
 * A handler returns the failure (an `Error` with a literal `kind`) or does
 * not (it absorbs the failure, with nothing or a value), never sometimes one
 * and sometimes the other (D-076, D-078).
 */
type HandlerCheck<H> =
  unknown extends HandlerReturn<H>
    ? {
        readonly "[ATTEMPT_RETURN] declare the handler's return type: Error, void, or a non-unknown value": never;
      }
    : [HandlerReturn<H>] extends [Error]
      ? KindCheck<HandlerReturn<H>>
      : [Extract<HandlerReturn<H>, Error>] extends [never]
        ? unknown
        : {
            readonly "[ATTEMPT_ABSORBS] a handler returns the failure (an Error with a literal kind) or absorbs it (returns nothing or a value), not sometimes one and sometimes the other": never;
          };
/**
 * A stream's failures arrive after the host's run (D-091), so a stream
 * attempt's handler is a plain function that transforms (returns an `Error`:
 * the stream fails) or absorbs (returns nothing: the stream ends). A
 * generator handler, or one returning a value, is refused.
 */
type StreamHandlerCheck<T, H> =
  true extends IsStream<T>
    ? [H] extends [Generator<any, any, any>]
      ? StreamHandlerRefused
      : [H] extends [Error | void]
        ? unknown
        : StreamHandlerRefused
    : unknown;
interface StreamHandlerRefused {
  readonly "[STREAM_HANDLER] a stream's failures arrive after the host's run: its handler is a plain function that returns an Error (the stream fails) or nothing (the stream ends)": never;
}
/** What an attempt gives: an event call's result; a promise's value; a stream as itself, handled. */
type Attempted<T> =
  T extends EventCall<infer R, any, any, any>
    ? R
    : Awaited<T> extends AsyncIterable<any>
      ? Awaited<T> & Handled
      : Awaited<T>;
/**
 * `yield* attempt(fn, onError)`: call `fn`; when it throws, or the promise it
 * returns rejects, `onError` handles what it caught (D-076, D-078). It may
 * be a generator — `function* (e) { … }` — run as routine code of the host
 * (an event's writes inside its transaction, a nested `attempt` for a retry
 * or a fallback, `yield* raise(e)` failing the attempt); its ops and colors
 * are the host's. Its return decides: the failure — an `Error` with a
 * literal `kind`, what was caught or a transformation of it — and the routine
 * fails with it, the failure's type its color; or nothing, and the failure is
 * absorbed (the attempt gives `undefined`, its value `T | undefined`); or a
 * value `V`, absorbed too (the attempt gives it, `T | V`). D-073: an effect
 * that handles its own failure adds none to its component. A handler that
 * may return an `Error` on one path and not on another is
 * `[ATTEMPT_ABSORBS]`. An attempt always handles its error: one without a
 * handler would be just a call.
 *
 * When `fn` returns a promise the routine suspends until it settles ($memo
 * and $event only) and resumes with its value. When it returns a stream (or
 * a promise of one) the attempt gives the stream back, its failures going
 * through `onError` as they come, after the host's run — so the handler is a
 * plain function: an `Error` fails the stream, nothing ends it (D-091). `return
 * yield* attempt(() => watch(feed), cause => new FeedError(cause))` is how a
 * memo's body returns a stream; an `$event` does not attempt one.
 *
 * When it returns an event call (D-077), `yield* attempt(() => post(msg), e =>
 * { … })` is `yield* post(msg)` with the call's failure handled: the handler
 * receives the call's typed failure (its `FailsOf`) and returns it, a
 * transformation, or nothing; the call's other colors (`P`, `A`) are the
 * routine's as with `yield*`. Only a typed failure (one `raise`d, or returned
 * by a handler) reaches it, in every build: a crash inside the call — a
 * plain `throw`, a `TypeError` — is a bug, and goes past the handler
 * (D-087). This is how a routine handles a failure — `try` /
 * `catch` is not a routine form (`no-try-catch`).
 */
export function attempt<T, H>(
  fn: () => T,
  onError: (error: Caught<T>) => H & HandlerCheck<H> & StreamHandlerCheck<T, H>
): Yieldable<AttemptOps<T, H>, AttemptResult<T, H>>;
export function attempt(fn: () => unknown, onError: (error: unknown) => unknown): unknown {
  return new Attempt(fn, onError);
}

class RaiseOp {
  constructor(readonly error: unknown) {}
  *[Symbol.iterator](): Generator<never, never, unknown> {
    throw brand(this.error);
  }
}
/** `yield* raise(error)`: the typed replacement for `throw` in a routine. */
export function raise<E extends Error>(error: E & KindCheck<E>): Yieldable<Raise<E>, never> {
  return new RaiseOp(error) as any;
}

/**
 * A write. Calling a setter does nothing by itself: it returns this receipt,
 * and the write happens when the receipt is delegated to (`yield* setX(v)`),
 * so every write is in the routine's type (a `Write` op) and only the hosts
 * that may write accept it. A setter call that is not delegated is a lint
 * error (`no-unyielded-write`).
 */
class Receipt<T> {
  /** Dev only: whether it was delegated to (`yield*`). */
  delegated = false;
  constructor(
    readonly write: () => T,
    readonly setter: string
  ) {}
  *[Symbol.iterator](): Generator<never, T, unknown> {
    if (__DEV__) {
      this.delegated = true;
      checkWrite();
    }
    return this.write();
  }
}

/**
 * Dev only (D-021): a receipt not delegated to by the end of its run wrote
 * nothing — the setter call was the bug (`setX(v)` where `yield* setX(v)`
 * was meant). The lint `no-unyielded-write` sees the plain cases; this sees
 * the rest (a setter handed to a helper, called in a callback).
 */
function checkReceipts(list: Receipt<unknown>[], host: Host, name: string | null): void {
  for (let i = 0; i < list.length; i++)
    if (!list[i].delegated)
      throw devError(
        "UNYIELDED_WRITE",
        `${list[i].setter} in <${name ?? "anonymous"}>: its receipt was not delegated to by the end of ${HOST_NAMES[host]}'s run, so it wrote nothing. A setter writes at yield* setX(v).`
      );
}
function checkWrite(): void {
  const host = state.host;
  if (host === SETUP || host === VIEW || host === MEMO || host === HOLE || host === COMPUTE)
    throw devError(
      "WRITE_IN_REACTIVE",
      `${HOST_NAMES[host]} does not write: write in an $event or an $effect's effect phase.`
    );
}
function receiptSetter(setter: string, set: (v: any) => any, value?: () => any): any {
  return (v: any) => {
    // D-028: with no routine running there is no run to report an unyielded
    // receipt at — the setter was handed to foreign code (`onClick={setX}`,
    // a timer): fail at the call
    if (__DEV__ && state.host === NONE)
      throw devError(
        "SETTER_OUTSIDE_RUN",
        `${setter} called outside a routine: a setter writes when its receipt is delegated to (yield* setX(v)) in an $event or an $effect; handed to plain code it writes nothing.`
      );
    const receipt = new Receipt(() => {
      const r = set(v);
      return value ? value() : r;
    }, setter);
    if (__DEV__) state.receipts?.push(receipt);
    return receipt;
  };
}

function checkCreate(kind: string): void {
  if (state.host !== SETUP)
    throw devError(
      "CREATE_OUTSIDE_SETUP",
      `$${kind} creates state: call it in a component's (or a row routine's) setup, not in ${HOST_NAMES[state.host]}.`
    );
}

/** @internal A creation: `make` runs only in a setup (`CREATE_OUTSIDE_SETUP`). */
export class CreateOp<T> {
  constructor(
    readonly kind: string,
    readonly make: () => T
  ) {}
  *[Symbol.iterator](): Generator<never, T, unknown> {
    if (__DEV__) checkCreate(this.kind);
    return this.make();
  }
}

/** `const [count, setCount] = yield* $signal(0)` in a setup. */
export function $signal<T>(
  value: T,
  options?: SignalOptions<T>
): Yieldable<Create<"signal">, [Source<T>, Setter<T>]> {
  return new CreateOp("signal", () => {
    const [get, set] = createSignal(value as any, options as any);
    return [asSource(get as Accessor<T>), receiptSetter("a $signal's setter", set as any)];
  }) as any;
}

/** `const [todos, setTodos] = yield* $store({ … })` in a setup. */
export function $store<T extends object>(
  value: T
): Yieldable<Create<"store">, [TypedStore<T>, StoreSetter<T>]> {
  return new CreateOp("store", () => {
    const [store, set] = createStore(value as any);
    return [
      makePath(store, false, []),
      receiptSetter("a $store's setter", set as any, () => store)
    ];
  }) as any;
}

/**
 * `const [sending, setSending] = yield* $optimistic(false)` in a setup: a
 * signal whose writes inside an `$event` show at once and revert when the
 * event's transaction settles (Solid's `createOptimistic`).
 *
 * The scalar form, as `$signal` is (D-014): it takes a value, never a body —
 * Solid's `createOptimistic(fn)` would derive from a function, and that is
 * `$optimisticStore(function* (draft) { … }, seed)`, as `$store` mirrors
 * `$signal`.
 */
export function $optimistic<T>(
  value: Exclude<T, Function>,
  options?: SignalOptions<T>
): Yieldable<Create<"optimistic">, [Source<T>, Setter<T>]> {
  return new CreateOp("optimistic", () => {
    if (__DEV__ && typeof value === "function")
      throw devError(
        "OPTIMISTIC_FORM",
        "$optimistic takes a value (its scalar form, as $signal); an optimistic value derived from a body is $optimisticStore(function* (draft) { … }, seed)."
      );
    const [get, set] = createOptimistic(value as any, options as any);
    return [asSource(get as Accessor<T>), receiptSetter("an $optimistic's setter", set as any)];
  }) as any;
}

/** A derived store's paths: pending and failing as its body is. */
type ProjectionStore<T, Y, R, E = never> = Path<T, FailsOf<Y> | E, MemoPending<Y, R>>;
/** With `seedLoadingValue: true` the seed is commit #0: the store is never pending. */
type SeededStore<T, Y, E = never> = Path<T, FailsOf<Y> | E>;

/**
 * `const [todos, setTodos] = yield* $optimisticStore(function* () { … }, [])`
 * in a setup: a store whose writes inside an `$event` show at once and revert
 * when the event settles (Solid's `createOptimisticStore`). With a body the
 * store is derived: the body reads with `yield*`, may wait on an async
 * `attempt` or return a stream through `attempt` (the store is then pending),
 * and may update the draft it is handed.
 *
 * The object-or-body form, as `$store` is (D-014); a scalar is `$optimistic`.
 */
export function $optimisticStore<T extends object>(
  value: T
): Yieldable<Create<"optimisticStore">, [TypedStore<T>, StoreSetter<T>]>;
export function $optimisticStore<T extends object, Y extends MemoOp = never, R = unknown>(
  body: (draft: T) => Generator<Y, SyncReturn<R>, any>,
  seed: Partial<T>,
  options: ProjectionOptions & { seedLoadingValue: true }
): Yieldable<Create<"optimisticStore">, [SeededStore<T, Y>, StoreSetter<T>]>;
export function $optimisticStore<T extends object, Y extends MemoOp = never, R = unknown>(
  body: (draft: T) => Generator<Y, SyncReturn<R>, any>,
  seed: Partial<T>,
  options?: ProjectionOptions
): Yieldable<Create<"optimisticStore">, [ProjectionStore<T, Y, R>, StoreSetter<T>]>;
export function $optimisticStore(first: any, seed?: any, options?: any): any {
  return new CreateOp("optimisticStore", () => {
    if (__DEV__ && (first === null || (typeof first !== "object" && typeof first !== "function")))
      throw devError(
        "OPTIMISTIC_FORM",
        "$optimisticStore takes an object or a body (its store form, as $store); an optimistic scalar is $optimistic(value)."
      );
    const [store, set] =
      typeof first === "function"
        ? createOptimisticStore(memoCompute(first) as any, seed, options)
        : createOptimisticStore(first);
    return [
      makePath(store, false, []),
      receiptSetter("an $optimisticStore's setter", set as any, () => store)
    ];
  });
}

/**
 * `const feed = yield* $projection(function* (draft) { … }, seed)` in a setup:
 * a derived store (Solid's `createProjection`). The body reads with `yield*`,
 * may wait, and updates the draft or returns the next value (a stream through
 * `attempt`).
 */
export function $projection<T extends object, Y extends MemoOp = never, R = unknown>(
  body: (draft: T) => Generator<Y, SyncReturn<R>, any>,
  seed: Partial<T>,
  options: ProjectionOptions & { seedLoadingValue: true }
): Yieldable<Create<"projection">, SeededStore<T, Y>>;
export function $projection<T extends object, Y extends MemoOp = never, R = unknown>(
  body: (draft: T) => Generator<Y, SyncReturn<R>, any>,
  seed: Partial<T>,
  options?: ProjectionOptions
): Yieldable<Create<"projection">, ProjectionStore<T, Y, R>>;
export function $projection(body: any, seed: any, options?: any): any {
  return new CreateOp("projection", () =>
    makePath(createProjection(memoCompute(body) as any, seed, options), false, [])
  );
}

class RefreshOp {
  constructor(readonly target: unknown) {}
  *[Symbol.iterator](): Generator<never, void, unknown> {
    if (__DEV__) checkWrite();
    const t = this.target as any;
    const pt = t != null ? t[PATH_TARGET] : undefined;
    void solidRefresh(pt ? pt.root : t);
  }
}
/**
 * `yield* refresh(todos)`: recompute a derived store or a memo (Solid's
 * `refresh`). It is a write: an `$event` or an `$effect` refreshes.
 */
export function refresh(
  target: Source<unknown, unknown, boolean> | Path<any, unknown, boolean>
): Yieldable<Write, void> {
  return new RefreshOp(target) as any;
}

/**
 * `yield* until(readStore(store, s => s.ready), onError, { timeout })`: wait
 * until a source reads truthy (Solid's `until`). It is an async `attempt`:
 * only a `$memo` or an `$event` waits, and `onError` is an attempt's
 * handler (D-076, D-078): it turns a failure (a timeout) into the routine's
 * error, or absorbs it (`until` then gives `undefined` or the handler's
 * value); it may be a generator run as the host's routine code.
 */
export function until<T, H>(
  source: Source<T, unknown, boolean>,
  onError: (error: unknown) => H & HandlerCheck<H>,
  options?: Parameters<typeof solidUntil>[1]
): Yieldable<AttemptOps<Promise<T>, H>, AttemptResult<Promise<T>, H>> {
  return attempt(() => solidUntil(accessor(source), options), onError as any) as any;
}

/** A memo's value: a promise's, an async iterable's latest — or a promise of an iterable's (Solid flattens one level). */
type MemoValue<R> = R extends PromiseLike<infer U> ? IteratedValue<U> : IteratedValue<R>;
type IteratedValue<R> = R extends AsyncIterable<infer U> ? U : R;
type MemoPending<Y, R> =
  PendingOf<Y> extends true ? true : R extends PromiseLike<any> | AsyncIterable<any> ? true : false;
/** A body's result that is a promise or a stream no `attempt` handled. */
type UnhandledAsync<R> = Exclude<Extract<R, PromiseLike<any> | AsyncIterable<any>>, Handled>;
/** A body returns a promise or a stream through `attempt`, whose handler types its failure. */
type NeedsAttempt = {
  readonly "a body that returns a promise or a stream wraps it: return yield* attempt(() => it, onError)": never;
};
/** @internal A body's return: anything but a promise or a stream no `attempt` handled. */
export type SyncReturn<R> = R & ([UnhandledAsync<R>] extends [never] ? unknown : NeedsAttempt);

/**
 * `$memo(body, { loadingValue })`: commit #0 is the loading value, so a read
 * never suspends — the memo is not pending (`isPendingOf` still reports a
 * newer value in flight). Its failures are the body's.
 */
export function $memo<Y extends MemoOp = never, R = unknown>(
  body: () => Generator<Y, SyncReturn<R>, any>,
  options: MemoOptions<MemoValue<R>> & { loadingValue: MemoValue<R> }
): Yieldable<Create<"memo">, Source<MemoValue<R>, FailsOf<Y>>>;
/**
 * `const doubled = yield* $memo(function* () { return (yield* n) * 2 })` in a setup.
 * A body over a promise or a stream returns it through `attempt`: `return
 * yield* attempt(() => watch(feed), cause => new FeedError(cause))`.
 */
export function $memo<Y extends MemoOp = never, R = unknown>(
  body: () => Generator<Y, SyncReturn<R>, any>,
  options?: MemoOptions<MemoValue<R>>
): Yieldable<Create<"memo">, Source<MemoValue<R>, FailsOf<Y>, MemoPending<Y, R>>>;
export function $memo(body: () => Generator<any, any, any>, options?: any): any {
  return new CreateOp("memo", () => memoOf(body, options));
}

/**
 * A stream whose failures go through an attempt's handler: a Proxy that keeps
 * the stream's own properties (a server function's brand, a live source's
 * `onstatus`) and changes only how it fails.
 */
function mapStream(value: unknown, onError: (error: unknown) => unknown): unknown {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) return value;
  if (typeof (value as any)[Symbol.asyncIterator] !== "function") return value;
  return new Proxy(value as any, {
    get(target, key) {
      if (key === Symbol.asyncIterator)
        return () => {
          const it = target[Symbol.asyncIterator]();
          return {
            next: (v?: unknown) =>
              it.next(v).then(undefined, (e: unknown) => ({
                done: true,
                value: handled(onError(e))
              })),
            return: it.return && ((v?: unknown) => it.return(v)),
            throw: it.throw && ((v?: unknown) => it.throw(v)),
            [Symbol.asyncIterator]() {
              return this;
            }
          };
        };
      return Reflect.get(target, key);
    },
    set(target, key, v) {
      return Reflect.set(target, key, v);
    }
  });
}

/**
 * A computation's function for a memo-like body: each run drives the body as
 * the MEMO host (reads, an async `attempt` that suspends, `raise`). A
 * superseded run is not closed (D-080): it runs to completion after its
 * pending attempt, as Solid's async memo does, and its result is discarded —
 * Solid keeps only the latest run's promise. The argument (a projection's
 * draft) is handed to the body.
 */
export function memoCompute(
  body: (arg?: any) => Generator<unknown, unknown, unknown>
): (arg?: unknown) => unknown {
  const name = state.name;
  return (arg?: unknown) => {
    let gen!: Generator<unknown, unknown, unknown>;
    const r = runAs(
      MEMO,
      () => {
        gen = body(arg);
        return gen.next();
      },
      null,
      null,
      false,
      false,
      name
    );
    if (r.done) return r.value;
    return resume(gen, r.value, MEMO, name);
  };
}

function memoOf(body: () => Generator<unknown, unknown, unknown>, options?: any): any {
  return asSource(createMemo(memoCompute(body) as any, options) as Accessor<unknown>);
}

/**
 * Continue a generator that yielded an async `attempt`: wait for its
 * promise, resume, and settle with the generator's result. A superseded run
 * continues too (D-080); whoever holds its promise discards its result.
 */
function resume(
  gen: Generator<unknown, unknown, unknown>,
  op: unknown,
  as: Host,
  name: string | null
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const step = (value: unknown, failed: boolean) => {
      let r: IteratorResult<unknown, unknown>;
      try {
        r = runAs(
          as,
          () => (failed ? gen.throw(value) : gen.next(value)),
          null,
          null,
          false,
          as === MEMO,
          name
        );
      } catch (e) {
        reject(e);
        return;
      }
      if (r.done) resolve(r.value);
      else wait(r.value);
    };
    const wait = (next: unknown) => {
      if (!isWait(next)) {
        try {
          runAs(
            as,
            () => drive({ next: () => ({ done: false, value: next }) } as any, SYNC_RUN),
            null,
            null,
            false,
            false,
            name
          );
        } catch (e) {
          reject(e);
        }
        return;
      }
      Promise.resolve(next.promise).then(
        v => step(v, false),
        e => step(e, true)
      );
    };
    wait(op);
  });
}

/**
 * `yield* $effect(compute, effect)` in a setup (D-079): Solid's
 * `createEffect`, both halves generators. `compute` runs tracked and pure —
 * reads, `raise`, a sync `attempt` — and returns a value; `effect(value,
 * prev)` runs after it: writes, `$cleanup`s (run before the next effect run,
 * or on disposal), a sync `attempt` or event call, and settled reads. Its
 * reads are untracked because the host is (Solid runs the effect phase
 * untracked, D-083), as an event's are; the library adds no untrack.
 *
 * What either half may fail with reaches the nearest `Errored` above the
 * component, so it joins the component's failures through the setup's
 * `Create<"effect", E>` (D-073): a compute failure is rethrown by the
 * effect's error arm (Solid would otherwise log and skip it), an effect-phase
 * failure is Solid's uncaught effect error. An attempt whose `onError`
 * absorbs the failure adds none.
 */
export function $effect(
  compute: (() => Generator<any, any, any>) & {
    readonly "[EFFECT_PHASES] $effect takes two functions: a tracked compute and an untracked effect": never;
  }
): never;
export function $effect<YC extends ComputeOp = never, V = void, YE extends EffectPhaseOp = never>(
  compute: () => Generator<YC, V, any>,
  effect: (value: V, prev: V | undefined) => Generator<YE, void, any>,
  options?: { name?: string }
): Yieldable<Create<"effect", FailsOf<YC> | FailsOf<YE>>, void>;
export function $effect<YC extends ComputeOp = never, V = void, YE extends EffectPhaseOp = never>(
  compute: () => Generator<YC, V, any>,
  effect?: (value: V, prev: V | undefined) => Generator<YE, void, any>,
  options?: { name?: string }
): Yieldable<Create<"effect", FailsOf<YC> | FailsOf<YE>>, void> {
  if (__DEV__ && !effect)
    throw devError(
      "EFFECT_PHASES",
      "$effect takes two functions: a tracked compute and an untracked effect."
    );
  return new CreateOp("effect", () => {
    const name = state.name;
    createEffect<V>(
      () => runAs(COMPUTE, () => drive(compute(), SYNC_RUN) as V, null, null, false, false, name),
      {
        effect: (value: V, prev?: V) => runEffect(() => effect!(value, prev), name, EFFECT),
        // a compute failure reaches the nearest Errored, as an effect-phase one
        // does (D-073): rethrown, it escalates to the boundary
        error: (err: unknown) => {
          throw err;
        }
      },
      options as any
    );
  }) as any;
}

function runEffect(
  body: () => Generator<unknown, unknown, unknown>,
  name: string | null,
  host: Host
): (() => void) | undefined {
  const sink: (() => void)[] = [];
  runAs(host, () => drive(body(), SYNC_RUN), sink, null, false, false, name);
  return sink.length ? () => runCleanups(sink) : undefined;
}
function runCleanups(sink: (() => void)[]): void {
  for (let i = sink.length - 1; i >= 0; i--) sink[i]();
}

class CleanupOp {
  constructor(readonly fn: () => void) {}
  *[Symbol.iterator](): Generator<never, void, unknown> {
    const { host, sink } = state;
    if (sink) sink.push(this.fn);
    else if (__DEV__ && host !== SETUP)
      throw devError(
        "CLEANUP_OUTSIDE_OWNER",
        `$cleanup belongs to a setup or an effect, not ${HOST_NAMES[host]}.`
      );
    else onCleanup(this.fn);
  }
}
/** `yield* $cleanup(fn)`: run `fn` when the component (or the effect run) is disposed. */
export function $cleanup(fn: () => void): Yieldable<Cleanup, void> {
  return new CleanupOp(fn) as any;
}

// --- context ------------------------------------------------------------------------------

/**
 * @internal `yield* Ctx` (D-036, D-098): a setup's read of a library context.
 * The value is read like a prop (D-042): a path over what the provider gave —
 * a value, a source or a hole — read where the setup's view, memo or event
 * reads it, never in the setup. A context created without a default that no
 * provider above gives is `NO_PROVIDER` here, at the read.
 */
export function readContext(ctx: any): unknown {
  const host = state.host;
  if (__DEV__ && host !== SETUP && host !== NONE)
    throw devError(
      "CONTEXT_OUTSIDE_SETUP",
      `yield* Ctx belongs to a setup, not ${HOST_NAMES[host]}.`
    );
  let raw: unknown;
  try {
    raw = useContext(ctx);
  } catch (e) {
    if (__DEV__ && getOwner() !== null && ctx.defaultValue === undefined)
      throw devError(
        "NO_PROVIDER",
        `<${state.name ?? "anonymous"}> reads ${ctx.id.description ? `the context ${ctx.id.description}` : "a context"}, created without a default, and no provider above it gives one: call the component inside Ctx.provide({ value, children }).`
      );
    throw e;
  }
  return makePath(raw, false, []);
}

// --- events ---------------------------------------------------------------------------------

/**
 * An `Errored` as a bind site sees it (D-085): the classes its `catch` lists
 * (`null`: it takes every failure) and the `Errored` above it.
 */
export interface Boundary {
  disposed: boolean;
  owner: ReturnType<typeof getOwner>;
  readonly catch: readonly (abstract new (...args: any) => unknown)[] | null;
  readonly parent: Boundary | null;
}

/**
 * Provided by `Errored` so a bind site knows which boundaries are above it
 * and what each takes (D-085, F-7). Solid has no public way to ask whether an
 * owner has an error boundary above it that will take a failure, and with
 * none `reportError` would halt the reactive system rather than let the call
 * reject.
 */
export const BOUNDARY = solidCreateContext<Boundary | null>(null);
export { solidCreateContext };

/** The nearest `Errored` above the current owner, as `BOUNDARY` gives it. */
export function boundaryAbove(): Boundary | null {
  if (!getOwner()) return null;
  try {
    return useContext(BOUNDARY) ?? null;
  } catch {
    return null;
  }
}

/** Whether some `Errored` in the chain will take `error`: the first whose `catch` covers it. */
export function takes(boundary: Boundary | null, error: unknown): boolean {
  for (let b = boundary; b; b = b.parent)
    if (!b.catch || b.catch.some(C => error instanceof C)) return true;
  return false;
}

/** An `$event` handler's call, with where a failure nobody handles goes (D-085). */
const CALL: unique symbol = Symbol("solid.yield.call") as any;
/** Takes a failure nobody handles, or answers `false`: then the call rejects. */
type Route = ((error: unknown) => boolean) | null;

/**
 * Bind an `$event` handler where it meets the DOM (D-085): `perform` in an
 * event attribute, `h`'s attribute bind. One wrapper per bind, which records
 * the bind site's `Errored` scopes: a call nobody handles (a
 * DOM dispatch) reports its failure there when one of them takes it (its
 * `catch` covers it, or it has none), and otherwise the call's promise
 * rejects (F-7: reported, it would leave Solid's flush and halt it). A call
 * that is handled — `yield*`, `await` — fails at its caller, wherever it was
 * bound.
 */
export function bindEvent<H>(handler: H): H {
  const call = (handler as any)[CALL] as (route: Route, args: unknown[]) => unknown;
  const boundary = boundaryAbove();
  const route: Route = boundary
    ? error => {
        let accepting: Boundary | null = boundary;
        while (accepting && accepting.catch && !accepting.catch.some(C => error instanceof C))
          accepting = accepting.parent;
        if (!accepting) return false;
        if (boundary.disposed || accepting.disposed) {
          if (__DEV__)
            console.error(
              devError(
                "BOUNDARY_DISPOSED",
                `${(error as any)?.kind ?? "failure"} arrived after its Errored was disposed — the event's own optimistic write removed it; absorb the failure in the event, or move the boundary above what the write can dispose`
              )
            );
          return false;
        }
        // The boundary owns the report: a disposable row below a live boundary
        // must not make delivery depend on that row's captured owner.
        reportError(boundary.owner, error);
        return true;
      }
    : null;
  const bound: any = (...args: unknown[]) => call(route, args);
  bound[EVENT_MARK] = true;
  bound[CALL] = call;
  bound[Symbol.iterator] = function* (): Generator<never, unknown, unknown> {
    return bound;
  };
  return bound;
}

function reportError(owner: ReturnType<typeof getOwner>, error: unknown): void {
  let delivered = false;
  runWithOwner(owner, () => {
    createRenderEffect(
      () => {
        if (!delivered) {
          delivered = true;
          throw error;
        }
      },
      () => {}
    );
  });
}

/**
 * Adapts an `$event` body to Solid's `action` driver: each step of the body
 * runs as the EVENT host, and an async `attempt` (a Wait) is handed to the
 * action as the promise it yields, so the action re-enters its transaction
 * before the body continues. A rejection comes back from the action's
 * `yield` and is thrown into the body at the `yield*`.
 */
function* eventSteps(
  gen: Generator<unknown, unknown, unknown>,
  name: string | null,
  receipts: Receipt<unknown>[] | null
): Generator<PromiseLike<unknown>, unknown, unknown> {
  let value: unknown;
  let failed = false;
  for (;;) {
    const r = runAs(
      EVENT,
      () => (failed ? gen.throw(value) : gen.next(value)),
      null,
      null,
      false,
      false,
      name,
      receipts
    );
    if (r.done) return r.value;
    const op = r.value;
    if (!isWait(op)) {
      try {
        gen.return(undefined);
      } catch {}
      return runAs(
        EVENT,
        () => drive({ next: () => ({ done: false, value: op }) } as any, SYNC_RUN),
        null,
        null,
        false,
        false,
        name,
        receipts
      );
    }
    try {
      value = yield op.promise;
      failed = false;
    } catch (e) {
      value = e;
      failed = true;
    }
  }
}

/**
 * `$event(function* (e) {…})`: an event handler that is a Solid `action`.
 * Every call is one transaction: writes are held until it settles (an
 * optimistic source shows its value at once), an async `attempt` suspends it
 * and re-enters the transaction when the promise settles, and a rejection is
 * thrown at the `yield*`. It takes any arguments and returns a promise of the
 * body's result, so it replaces `action` in routine code.
 *
 * A failure goes to whoever handles the returned promise (`await`, `.then`,
 * `.catch`, `yield*`). One nobody handles — a DOM dispatch ignores the result
 * — goes to the nearest `Errored` above where the handler was bound that
 * takes it (D-085; the promise then resolves `undefined`); with no such
 * boundary there (none, or only ones whose `catch` excludes it, F-7), or for
 * a call of the unbound handler, the promise rejects.
 * Like any action it is called from an event or other imperative code, not
 * synchronously inside a computation (ACTION_CALLED_IN_OWNED_SCOPE).
 */
export function $event<Args extends unknown[] = [], Y extends EventOp = never, R = void>(
  body: (...args: Args) => Generator<Y, R, any>
): EventHandler<Args, FailsOf<Y>, R, ReadsPendingOf<Y>, WaitsOf<Y>> {
  const name = state.name;
  const run = action(function* (rec: CallRecord, ...args: Args) {
    try {
      // one list for the whole call: a receipt minted before an async
      // attempt and delegated to after it is not unyielded
      const receipts: Receipt<unknown>[] | null = __DEV__ ? [] : null;
      const value = yield* eventSteps(
        body(...args) as Generator<unknown, unknown, unknown>,
        name,
        receipts
      );
      if (receipts !== null && receipts.length) checkReceipts(receipts, EVENT, name);
      rec.done = { ok: true, value };
      return value;
    } catch (error) {
      rec.done = { ok: false, value: error };
      throw error;
    }
  });
  const call = (route: Route, args: Args) => {
    // A failure goes to whoever handles the returned promise; one nobody
    // handles (a DOM dispatch ignores the result) goes to the bind site's
    // boundary (D-085).
    const rec: CallRecord = {};
    let handled = false;
    const result = run(rec, ...args).then(undefined, (error: unknown) => {
      if (!handled && route && route(error)) return undefined;
      throw error;
    });
    (result as any)[EVENT_CALL_MARK] = true;
    const then = result.then.bind(result);
    result.then = ((onFulfilled?: any, onRejected?: any) => {
      handled = true;
      return then(onFulfilled, onRejected);
    }) as typeof result.then;
    // `yield* call`: a write that waits for the call — at once when the body
    // already finished (a synchronous event, as an `$effect` may delegate to).
    (result as any)[Symbol.iterator] = function* (): Generator<unknown, unknown, unknown> {
      if (__DEV__) checkWrite();
      const done = rec.done;
      if (done) {
        handled = true;
        then(undefined, () => {});
        if (done.ok) return done.value;
        throw done.value;
      }
      return yield new Wait_(result);
    };
    return result;
  };
  const handler: any = (...args: Args) => call(null, args);
  handler[EVENT_MARK] = true;
  handler[CALL] = call;
  // `yield* save`: bind it (D-072, D-085) — a wrapper for the DOM, routing
  // to the bind site; the JSX transform's `perform(save)` binds the same way
  handler[Symbol.iterator] = function* (): Generator<never, unknown, unknown> {
    return bindEvent(handler);
  };
  return handler;
}

/** Whether (and how) an event call's body finished. */
interface CallRecord {
  done?: { ok: boolean; value: unknown };
}

// --- routines -----------------------------------------------------------------------------------

function isGeneratorFunction(fn: unknown): fn is (...args: any[]) => Generator {
  return typeof fn === "function" && Object.getPrototypeOf(fn) === GeneratorFunctionPrototype;
}
const GeneratorFunctionPrototype = Object.getPrototypeOf(function* () {});

function runHole(
  body: () => Generator<unknown, unknown, unknown>,
  name: string | null = state.name
): unknown {
  return runAs(HOLE, () => drive(body(), HOLE_RUN), null, null, false, false, name);
}

/**
 * @internal A bare zero-arity `function*` in a hole position (a child or an
 * attribute value of `h`, a flow control's source prop): one
 * computation's read, not memoized, readable as a source.
 */
export function holeOf(
  body: () => Generator<unknown, unknown, unknown>,
  name: string | null = state.name
): any {
  const routine: any = () => runHole(body, name);
  routine[READ] = routine;
  routine[Symbol.iterator] = sourceIterator;
  return routine;
}

/** @internal The component (or row) the running routine belongs to (dev errors name it). */
export function routineName(): string | null {
  return state.name;
}

/**
 * @internal A flow control's prop read where the flow control reads it: a
 * source or a path is read through, and a bare zero-arity `function*` (a
 * no-JSX hole) runs as a hole.
 */
export function throughHole(v: any): any {
  return isGeneratorFunction(v) && v.length === 0 ? runHole(v) : through(v);
}

/**
 * @internal A flow control's creation (`For(…)`, `Show(…)`, a boundary): what
 * it reads of its props is its own read, never the holding view's top-level
 * one. On the client Solid's flow controls read inside their own computation
 * (`checkRead` sees the observer); on the server they read synchronously,
 * with no observer, while the view runs — in development that was a false
 * `READ_IN_VIEW` in every named component holding a flow control (found by
 * the conformance harness, D-039). A flow control's later prop reads go
 * through here too (`propRead` in flow.ts): a server memo whose first read
 * was pending reads again while the view's template resolves its hole.
 */
export function flowControl<T>(create: () => T): T {
  if (!__DEV__ || state.view === null) return create();
  const prev = state;
  state = { ...prev, view: null };
  try {
    return create();
  } finally {
    state = prev;
  }
}

// --- components and views -------------------------------------------------------------------

function runSetup(
  body: (...args: any[]) => Generator<unknown, unknown, unknown>,
  args: unknown[],
  name: string
): unknown {
  // a child's setup is not its parent view's top level, nor a JSX read
  return runAs(SETUP, () => drive(body(...args), SYNC_RUN), null, null, false, false, name);
}

/**
 * Render a view generator: run it once, as the VIEW host, and return what it
 * built. Every read is a hole's (D-032); in development a read at the view's
 * own top level is `READ_IN_VIEW`, naming the component (or row).
 */
export function renderView(
  viewFn: () => Generator<unknown, unknown, unknown>,
  name = "anonymous"
): unknown {
  return runAs(
    VIEW,
    () => drive(viewFn(), SYNC_RUN),
    null,
    __DEV__ ? name : null,
    false,
    false,
    name
  );
}

/**
 * `component(function* (props) { setup; return function* () { view } })`.
 *
 * The setup runs once, in the hole that calls it (`component` creates no owner):
 * it creates state there and reads context from there up. The view only reads. Neither
 * is wrapped in an untrack (D-097): a setup does not read (D-042; the types,
 * and `READ_IN_SETUP` in development) and a view reads only in its holes,
 * each its own computation, so a component called in a hole subscribes that
 * hole to nothing of its own.
 * The component's failures are its view's and its setup's effects' (`FailsOf<Y>`,
 * D-073): an `$effect` fails to the nearest `Errored` above it.
 * Its requirements (D-098) are its view's — the components it calls, less
 * what a `Ctx.provide` in the view gives them — and its setup's context
 * reads (`RequiresOf<Y>`), which were resolved where the component was
 * created: a provider in its own view cannot give them.
 *
 * Two signatures (D-098 amended). A setup that is not generic gets a call
 * generic in its props literal (`HoleCall`), so the call's view carries
 * what its hole props require (`HoleRequires`). A generic setup (D-029)
 * fails that overload (TypeScript cannot infer its props) and gets the
 * plain function type, which keeps its type parameters: TypeScript passes a
 * generic argument's type parameters on only to a result with one
 * non-generic call signature. Its hole props carry no requirement.
 */
export function component<
  TP = unknown,
  Y extends SetupOp = never,
  V extends () => Generator<ViewOp, unknown, any> = ViewFn<never, unknown>
>(
  body: ((props: TP) => Generator<Y, V, any>) & ViewWrapperCheck<V>,
  ..._rule: NoJsxViewRule<ViewYield<V>, ViewReturn<V>>
): HoleCall<
  PropsOf<TP>,
  ViewPending<ViewYield<V>, ViewReturn<V>>,
  ViewFails<ViewYield<V>, ViewReturn<V>> | FailsOf<Y>,
  ViewMayWait<ViewYield<V>, ViewReturn<V>>,
  ViewRequires<ViewYield<V>, ViewReturn<V>> | RequiresOf<Y>
>;
export function component<
  TP = unknown,
  Y extends SetupOp = never,
  V extends () => Generator<ViewOp, unknown, any> = ViewFn<never, unknown>
>(
  body: ((props: TP) => Generator<Y, V, any>) & ViewWrapperCheck<V>,
  ..._rule: NoJsxViewRule<ViewYield<V>, ViewReturn<V>>
): (
  ...props: PropsArgs<PropsOf<TP>>
) => ComponentView<
  ViewPending<ViewYield<V>, ViewReturn<V>>,
  ViewFails<ViewYield<V>, ViewReturn<V>> | FailsOf<Y>,
  ViewMayWait<ViewYield<V>, ViewReturn<V>>,
  ViewRequires<ViewYield<V>, ViewReturn<V>> | RequiresOf<Y>
>;
export function component<
  TP = unknown,
  Y extends SetupOp = never,
  V extends () => Generator<ViewOp, unknown, any> = ViewFn<never, unknown>
>(
  body: ((props: TP) => Generator<Y, V, any>) & ViewWrapperCheck<V>,
  ..._rule: NoJsxViewRule<ViewYield<V>, ViewReturn<V>>
): (
  ...props: PropsArgs<PropsOf<TP>>
) => ComponentView<
  ViewPending<ViewYield<V>, ViewReturn<V>>,
  ViewFails<ViewYield<V>, ViewReturn<V>> | FailsOf<Y>,
  ViewMayWait<ViewYield<V>, ViewReturn<V>>,
  ViewRequires<ViewYield<V>, ViewReturn<V>> | RequiresOf<Y>
> {
  const comp: any = function (props?: object) {
    const view = runSetup(body as any, [typedProps(props || {})], body.name || "anonymous");
    if (typeof view !== "function")
      throw devError(
        "COMPONENT_VIEW",
        "a component's setup returns its view: `return view(function* () { return <…/>; })`."
      );
    const out = renderView(view as any, body.name || "anonymous");
    // A view that returns a function — a foreign component's output at its
    // root (a context provider's tag: Solid's provider returns its
    // `children` memo), an `h` thunk — returns content, as a lazy
    // component's does (`yieldComponent`): `perform` passes it on to be
    // inserted. Unmarked, the holding hole called it, so the hole read
    // what it shows and re-ran when that changed — an `Errored` under the
    // provider switching to its fallback re-created the component, its
    // setup and state, and the fallback never showed (D-085's note).
    if (typeof out === "function" && (out as any)[READ] === undefined)
      (out as any)[VIEW_MARK] = true;
    return out;
  };
  comp[COMPONENT_MARK] = true;
  // Dev owner labels (`in <App> › <Card> › …`) use the component's name: a
  // named setup (`component(function* Card(props) {…})`) names it; an
  // anonymous one is "component".
  Object.defineProperty(comp, "name", { value: body.name || "component" });
  return comp;
}

/**
 * `return view(function* () { return <…/>; })`: a view, type-checked where
 * it is written (D-054). Identity at run time. Without it a view's mistakes
 * (an op a view may not perform — a creation, a write; a no-JSX view's read)
 * are reported at the `component(` call, with the whole setup's yield union;
 * with it they are reported at the `view(` call, naming the op. Its colors
 * are kept: the component is pending / failing as the view is.
 */
export function view<Y extends ViewOp = never, R = unknown>(
  fn: () => Generator<Y, R, any>,
  ..._rule: NoJsxViewRule<Y, R>
): ViewFn<[R] extends [HView<any, any, any, any>] ? never : Y, R> {
  // an `h` view's colors are its output's: its yields (refused above) are not
  // passed on, so `component` does not report the same mistake again
  return fn as any;
}

/**
 * D-089: a setup returns its view through `view(…)`. A bare `function*`
 * returned instead lacks `view`'s brand, and the setup is refused with the
 * message (checked on the setup itself, so that TypeScript prints it first).
 */
export type ViewWrapperCheck<V> = [V] extends [ViewWrapped]
  ? unknown
  : { readonly "[VIEW_WRAPPER] wrap the view: return view(function* () { ... })": never };

/** What a view function yields (a setup may return one of several views). */
export type ViewYield<V> = V extends () => Generator<infer Y, any, any> ? Y : never;
/** What a view function returns. */
export type ViewReturn<V> = V extends () => Generator<any, infer R, any> ? R : never;

/**
 * A no-JSX view (one returning `h` output) has no body (D-032): it
 * yields nothing — every read is a hole (a source, or a bare `function*`
 * given to `h`), a child is `h(Child, props)`. Its pending and
 * failures are its output's. Violations surface as a missing argument naming
 * the rule. (A JSX view cannot be held to this by its type: TypeScript sees a
 * `yield*` in a JSX position — a hole, after the transform — as the view's
 * own yield, and that is how the view's coloring is its holes'. There the
 * rule is the dev error `READ_IN_VIEW` and the lint `no-read-in-view-body`.)
 */
export type NoJsxViewRule<VY, R> = [R] extends [HView<any, any, any, any>]
  ? [VY] extends [never]
    ? []
    : [
        error: "[HVIEW_READ] a no-JSX view does not read: pass the source, or a bare function* hole, to h"
      ]
  : [];

/**
 * @internal A Solid component (Solid's `lazy()` or `dynamic()` output) made a
 * yield component: usable in call form in a hole — `{yield* Page()}` — as a
 * `component` is: created untracked (as a tag is, `createComponent`), so the
 * hole does not re-create it when what it builds changes (a chunk landing),
 * and its output passed on as a view. Its own keys (`preload`, `moduleUrl`)
 * are kept.
 */
export function yieldComponent<T extends (props: any) => any>(comp: T): any {
  const wrapped: any = function (props?: object) {
    const out = untrack(() => comp(props || {}));
    if (typeof out === "function" && out[READ] === undefined) out[VIEW_MARK] = true;
    return out;
  };
  for (const key of Object.keys(comp)) wrapped[key] = (comp as any)[key];
  wrapped[COMPONENT_MARK] = true;
  if (comp.name) Object.defineProperty(wrapped, "name", { value: comp.name });
  return wrapped;
}

export function isComponent(value: unknown): boolean {
  return typeof value === "function" && (value as any)[COMPONENT_MARK] === true;
}

/** Whether a render callback is a row routine: a generator function. */
export function isRowRoutine(fn: unknown): boolean {
  return isGeneratorFunction(fn);
}

/**
 * Run a row routine. A row's body is a setup, as a `component`'s is: it runs
 * once per row (per item of a `For`, per shown branch), untracked, with the
 * render arguments as reads; it creates (a `yield* $memo` there is the row's,
 * disposed with it) and returns the row's view, which is rendered as a
 * component's is.
 */
export function runRow(
  body: (...args: any[]) => Generator<unknown, unknown, unknown>,
  args: unknown[]
): unknown {
  return untrack(() => {
    const rowName = body.name ? `row ${body.name}` : "row";
    const view = runSetup(body, args, rowName);
    if (
      typeof view !== "function" ||
      (view as any)[READ] !== undefined ||
      (view as any)[VIEW_MARK] === true
    ) {
      if (__DEV__)
        throw devError(
          "ROW_VIEW",
          "a row's body is a setup: it returns the row's view, `return function* () { return <…/> }`."
        );
      return view;
    }
    return renderView(view as any, rowName);
  });
}

export { isGeneratorFunction };
