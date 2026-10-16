import type { JSX } from "@solidjs/web";
/** Compiler-only control flow. Delegation keeps the current host and transaction. */
import { untrack } from "solid-js";
import {
  accessor,
  bindEvent,
  EVENT_MARK,
  getterSource,
  isFailure,
  nativeHostCallback,
  perform,
  through
} from "./runtime.js";
import type {
  Bind,
  Bound,
  BoundEvent,
  EventHandler,
  ChildView,
  Read,
  Raise,
  StreamAttempt,
  Yieldable,
  EventCallOp,
  FailsOf,
  ReadsPendingOf,
  Source,
  EventOp,
  MemoOp,
  ComputeOp,
  EffectPhaseOp,
  HoleOp
} from "./types.js";
// Creation, binding and child-view failures may arrive after this lexical scope.
// Only failures delivered by immediate operations are discharged here.
export type NativeHandled<Y> =
  Y extends Read<infer P, unknown>
    ? Read<P, never>
    : Y extends Raise<unknown>
      ? never
      : Y extends EventCallOp<infer P, infer A, unknown>
        ? EventCallOp<P, A, never>
        : Y;
export function* nativeTry<Y, R, H, V, F = never>(
  body: () => Generator<Y, R, unknown>,
  handler: (error: FailsOf<Y>) => Generator<H, V, unknown>,
  finalizer?: () => Generator<F, unknown, unknown>
): Generator<NativeHandled<Y> | H | F, R | V, unknown> {
  try {
    // The catch below changes failure delivery, never operation execution.
    return yield* body() as Generator<NativeHandled<Y>, R, unknown>;
  } catch (error) {
    if (!isFailure(error)) throw error; // Pending and driver errors must never be swallowed.
    return yield* handler(error as FailsOf<Y>);
  } finally {
    if (finalizer) yield* finalizer();
  }
}
export function* nativeMap<T, Y, R>(
  items: readonly T[],
  callback: (value: T, index: number, array: readonly T[]) => Generator<Y, R, unknown>
): Generator<Y, R[], unknown> {
  const result = new Array<R>(items.length),
    length = items.length;
  for (let index = 0; index < length; index++)
    if (index in items) result[index] = yield* callback(items[index]!, index, items);
  return result;
}

/** The fallback event for an attribute Solid's JSX does not type (`on:click`). */
interface NativeFallbackEvents {
  Event: Event;
  MouseEvent: MouseEvent;
  KeyboardEvent: KeyboardEvent;
  InputEvent: InputEvent;
}
/** The event a native handler is called with, as Solid's JSX types it
 * (`onPointerDown` on a `div`: a `PointerEvent` whose `currentTarget` is the
 * div). An attribute Solid does not type takes the `Kind` event, on the
 * element. Every argument is a literal, so TypeScript computes one
 * instantiation per element and attribute however many handlers share it. */
export type NativeEventOf<
  Tag extends string,
  Attribute extends string,
  Kind extends keyof NativeFallbackEvents
> = Tag extends keyof JSX.IntrinsicElements
  ? Attribute extends keyof JSX.IntrinsicElements[Tag]
    ? HandlerEvent<
        Extract<NonNullable<JSX.IntrinsicElements[Tag][Attribute]>, (event: never) => unknown>,
        NativeFallbackEvents[Kind] & { currentTarget: ElementOf<Tag> }
      >
    : NativeFallbackEvents[Kind] & { currentTarget: ElementOf<Tag> }
  : NativeFallbackEvents[Kind] & { currentTarget: ElementOf<Tag> };
type ElementOf<Tag extends string> = Tag extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[Tag]
  : Tag extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[Tag]
    : Element;
type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
/** A native handler's event as Solid's JSX types it, given the event type
 * the lowering read from Solid's types (scripts/native-events.mjs): the
 * element is `currentTarget`, and an input, change or focus handler's
 * `target` is the element when it is a form control. Cheap: no JSX lookup. */
export type NativeHandlerEvent<
  E extends Event,
  Tag extends string,
  Kind extends "plain" | "input" | "change" | "focus"
> = E & {
  currentTarget: ElementOf<Tag>;
  target: Kind extends "plain"
    ? Element
    : ElementOf<Tag> extends FormControl
      ? ElementOf<Tag>
      : Element;
};
type HandlerEvent<H, Fallback> = [H] extends [never]
  ? Fallback
  : H extends (event: infer E) => unknown
    ? E
    : Fallback;

export type NativeArguments<T> =
  T extends Source<infer V, unknown, boolean>
    ? NativeArguments<V>
    : T extends (...args: infer A) => unknown
      ? A
      : never;

/** The prototype has no view binding in which to register a foreign callback's
 * failure color. Keep that missing edge visible to generated TypeScript. */
type CallbackFails<H> = H extends Iterable<infer Y> ? FailsOf<Y> : never;
export function nativeCallback<H>(
  handler: H &
    ([CallbackFails<NoInfer<H>>] extends [never]
      ? unknown
      : {
          readonly "[NATIVE_CALLBACK_FAILURE] foreign callback failure registration is not implemented; handle failures inside the callback": CallbackFails<H>;
        })
): H {
  return handler;
}

/** Invoke a captured method without consulting its user-visible .call property.
 * Typed by its parameters and result, not `Parameters<F>`/`ReturnType<F>`, so a
 * generic method (`Effect.runPromise`) is instantiated from its arguments. */
export function nativeInvoke<F>(
  fn: 0 extends 1 & F ? F : never,
  receiver: unknown,
  args: readonly unknown[]
): any; // a method of `any` returns `any`, as in TypeScript
export function nativeInvoke<A extends unknown[], R>(
  fn: (...args: A) => R,
  receiver: unknown,
  args: A
): R;
export function nativeInvoke(fn: any, receiver: unknown, args: readonly unknown[]): unknown {
  return Reflect.apply(fn, receiver, args);
}

/** A type guard's attempted result, keeping its narrowing: the attempt ran the
 * guard (`Exit.isSuccess(exit)`); `guard` is passed only for its type. */
export function nativeGuarded<T, U extends T>(
  value: T,
  result: boolean,
  guard: (value: T, ...rest: any[]) => value is U
): value is U {
  void value;
  void guard;
  return result;
}

/** A source-authored dynamic action call has unchecked arguments, but its
 * selected event still carries its inferred operations and failure colors. */
export function nativeDispatch<F extends (...args: never[]) => unknown>(
  fn: F,
  args: readonly unknown[]
): ReturnType<F> {
  return Reflect.apply(fn, undefined, args) as ReturnType<F>;
}

/** A lexical callback: callable, and delegating to it (`yield*`, F-S46) yields
 * its operations into the host and gives back the callback. */
type LexicalCallback<A extends unknown[], Y, R> = ((...args: A) => R) & {
  [Symbol.iterator](): Generator<Y, LexicalCallback<A, Y, R>, unknown>;
};

type LexicalPhase = "event" | "memo" | "compute" | "effect" | "hole" | "setup";
// A component body's synchronous callback (`items().filter(x => x > n())`):
// its operations are the body's, admitted or refused there (READ_IN_SETUP).
type PhaseOps<M extends LexicalPhase> = M extends "setup"
  ? unknown
  : M extends "event"
    ? EventOp
    : M extends "memo"
      ? MemoOp
      : M extends "compute"
        ? ComputeOp
        : M extends "effect"
          ? EffectPhaseOp
          : // A hole callback may build JSX, as a view does (F-S44: `.map(item => <Row/>)`).
              HoleOp | ChildView<boolean, any, boolean, any> | Bind<boolean, any>;
/** The phase argument keeps host admission visible in generated TypeScript. */
export function nativeLexicalCallback<
  M extends LexicalPhase,
  A extends unknown[],
  Y extends PhaseOps<NoInfer<M>>,
  R
>(phase: M, body: (...args: A) => Generator<Y, R, unknown>): LexicalCallback<A, Y, R>;
export function nativeLexicalCallback<
  M extends LexicalPhase,
  A extends unknown[],
  Y extends PhaseOps<NoInfer<M>>,
  R
>(
  phase: M,
  body: (...args: A) => Generator<Y, R, unknown>,
  deferred: true
): LexicalCallback<A, Y, R | Promise<R>>;
export function nativeLexicalCallback(
  _phase: LexicalPhase,
  body: (...args: any[]) => Generator<unknown, unknown, unknown>,
  deferred = false
): any {
  const callback = nativeHostCallback(body, deferred, _phase === "event");
  Object.defineProperty(callback, Symbol.iterator, {
    value: function* () {
      return callback;
    }
  });
  return callback;
}

/**
 * D-126: a reactive prop a caller may leave out (`label?:`, as the native
 * lowering widens one) is `undefined` in the child where it was left out;
 * Solid reads it where it is named. Its path is read when there is one.
 */
export function nativeOptional<T, E, P extends boolean>(
  source: Source<T, E, P> | undefined
): Yieldable<Read<P, E>, T | undefined> {
  return {
    *[Symbol.iterator]() {
      return source === undefined ? undefined : yield* source;
    }
  };
}

/** A hole callback's operations as its view sees them: a raise is a failure
 * of the hole's read; a stream attempt's failures arrive through its handler. */
export type HoleViewOp<Y> =
  Y extends Raise<infer E> ? Read<false, E> : Y extends StreamAttempt ? never : Y;
/**
 * F-S46: `yield* nativeHoleColors(callback)` in a JSX hole delegates a hole
 * callback's colors to its view, which gives back the callback. A callback
 * that runs in its own host must color that host: a pending or failing read
 * inside `items().map(…)` is the hole's.
 */
export function nativeHoleColors<C extends Iterable<unknown>>(
  callback: C
): Yieldable<HoleViewOp<C extends Iterable<infer Y> ? Y : never>, C> {
  return {
    *[Symbol.iterator]() {
      return callback;
    }
  } as Yieldable<HoleViewOp<C extends Iterable<infer Y> ? Y : never>, C>;
}

/**
 * A call that may fail, made in a JSX hole (`<p>{format(name())}</p>`): its
 * attempt runs where the view evaluates the hole, and what it raises is the
 * hole's failure, carried by the view as a failing read (as `nativeHoleColors`
 * carries a hole callback's).
 */
export function nativeHole<Y, R>(work: Yieldable<Y, R>): Yieldable<HoleViewOp<Y>, R> {
  return work as unknown as Yieldable<HoleViewOp<Y>, R>;
}

/**
 * D-116's capture rule: a source handed to plain code that takes an accessor
 * (`useDebounced(count)`, `mapArray(items, …)`). The host takes the source's
 * colors, as if it read it there, since the plain code may read it at once;
 * the plain code gets Solid's accessor, which reads the source where it is
 * called. Nothing is read here: at run time the host does what Solid's does.
 */
export function nativeAccessor<T, E, P extends boolean>(
  source: Source<T, E, P>
): Yieldable<Read<P, E>, () => T> {
  return {
    *[Symbol.iterator]() {
      return accessor(source);
    }
  } as any;
}
/** Message for a colored source handed to plain code in setup. */
type ColoredCapture = {
  readonly "[COLORED_CAPTURE] a source that may be pending or fail is handed to plain code in setup, where its reads are outside the check: read it in JSX or a memo and pass the value": never;
};
/**
 * In setup the plain code given a source reads it later, where the check
 * cannot follow it. A settled source loses nothing there; one that may be
 * pending or fail would lose its colors, so it is refused (D-116: no failure
 * union is cast away).
 */
export function nativeAccessorSetup<T, E, P extends boolean>(
  source: Source<T, E, P> &
    ([E] extends [never] ? ([P] extends [false] ? unknown : ColoredCapture) : ColoredCapture)
): Yieldable<never, () => T> {
  return {
    *[Symbol.iterator]() {
      return accessor(source);
    }
  } as any;
}
/** A spread object's members as Solid's spread takes them: a source as the
 * value it reads, an `$event` bound, and a plain function under an `on…`
 * key (a prop's handler) bound as Solid binds it, as `onClick={props.onClick}`
 * is. `any` slots: a member carrying its caller's colors as type parameters
 * (D-119) is still known to be a source. */
type SpreadValues<O> = {
  [K in keyof O]: SpreadValue<K, O[K] extends Source<infer T, any, any> ? T : O[K]>;
};
type SpreadValue<K, V> =
  V extends EventHandler<infer A, any, any, any, any>
    ? BoundEvent<A>
    : K extends `on${string}`
      ? V extends (...args: any[]) => unknown
        ? Bound<V>
        : // Solid's bound form, `[handler, data]`
          V extends { 0: infer H extends (...args: any[]) => unknown; 1: infer D }
          ? { 0: Bound<H>; 1: D }
          : V
      : V;
/** What a spread does: a read per source member, a binding per `$event`. */
type SpreadReads<O> = {
  [K in keyof O]-?: O[K] extends Source<unknown, infer E, infer P>
    ? Read<P, E>
    : O[K] extends EventHandler<any, infer E, any, infer P, any>
      ? Bind<P, E>
      : never;
}[keyof O];
/**
 * D-116 on a DOM spread (`<div {...props}>`, `<button {...omit(props, "label")}>`,
 * `<button {...{ onClick: () => … }}>`): Solid's spread reads each member in
 * its own effect. The host takes the colors of every source member, as if it
 * read them there, and binds every `$event` member, as an event attribute
 * does (D-072); the element gets the object with each source member read
 * through and each `$event` bound where the spread reads it. Nothing is read
 * here.
 */
export function nativeSpread<O>(spread: O): Yieldable<SpreadReads<O>, SpreadValues<O>> {
  return {
    *[Symbol.iterator]() {
      if (spread == null || typeof spread !== "object") return spread;
      // each handler bound once, at this spread's boundary
      const boundEvents = new WeakMap<object, unknown>();
      return new Proxy(spread, {
        get: (target, key) => {
          const value = Reflect.get(target, key);
          if (typeof key === "symbol") return value;
          const read = through(value);
          if (typeof read !== "function" || (read as any)[EVENT_MARK] !== true) return read;
          let bound = boundEvents.get(read);
          if (!bound) boundEvents.set(read, (bound = bindEvent(read)));
          return bound;
        }
      });
    }
  } as any;
}
/** Drive `body` with each synchronous step untracked; what it yields goes to the host. */
function* untracked<T>(body: () => Generator<unknown, T, unknown>): Generator<unknown, T, unknown> {
  const it = body();
  let step = untrack(() => it.next());
  try {
    while (!step.done) {
      let input: unknown,
        error: unknown,
        threw = false;
      try {
        input = yield step.value;
      } catch (e) {
        threw = true;
        error = e;
      }
      step = untrack(() => (threw ? it.throw(error) : it.next(input)));
    }
    return step.value;
  } finally {
    if (!step.done) it.return(undefined as T);
  }
}
/**
 * D-124: Solid's `untrack(() => …)` in a routine. The body's reads are the
 * host's, with their colors (a pending read there still suspends), but not
 * tracked: the host does not rerun when they change.
 */
export function nativeUntrack<Y, T>(body: () => Generator<Y, T, unknown>): Yieldable<Y, T> {
  return { [Symbol.iterator]: () => untracked(body) } as any;
}
/**
 * `untrack` in a component's body is how Solid reads once where nothing
 * tracks: admitted for settled reads. A read that may be pending or fail
 * would lose its colors there (D-116: none is cast away), so it is refused.
 */
export function nativeUntrackSetup<Y, T>(
  body: (() => Generator<Y, T, unknown>) &
    ([UntrackedColors<Y>] extends [never]
      ? unknown
      : {
          readonly "[COLORED_CAPTURE] a source that may be pending or fail is read untracked in setup, where its reads are outside the check: read it in JSX or a memo": never;
        })
): Yieldable<never, T> {
  return { [Symbol.iterator]: () => untracked(body) } as any;
}
/** The pending or failing reads among a body's operations. */
type UntrackedColors<Y> =
  Y extends Read<infer P, infer E>
    ? [E] extends [never]
      ? [P] extends [false]
        ? never
        : Y
      : Y
    : never;
/**
 * D-124: a getter that reads (`{ get total() { return count() * 2; } }`,
 * Solid's reactive props object) hands back a source over its body: whoever
 * reads the property reads through it, where Solid's getter would run, with
 * the body's colors.
 */
export function nativeGetter<Y, T>(
  body: () => Generator<Y, T, unknown>
): Source<T, FailsOf<Y>, ReadsPendingOf<Y>> {
  return getterSource(() => perform({ [Symbol.iterator]: body } as Yieldable<Y, T>)) as any;
}
