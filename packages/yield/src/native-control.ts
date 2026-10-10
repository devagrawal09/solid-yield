/** Compiler-only control flow. Delegation keeps the current host and transaction. */
import { isFailure, nativeHostCallback } from "./runtime.js";
import type {
  Read,
  Raise,
  EventCallOp,
  FailsOf,
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

/** Invoke a captured method without consulting its user-visible .call property. */
export function nativeInvoke<F extends (...args: any[]) => any>(
  fn: F,
  receiver: unknown,
  args: Parameters<F>
): ReturnType<F> {
  return Reflect.apply(fn, receiver, args);
}

/** A source-authored dynamic action call has unchecked arguments, but its
 * selected event still carries its inferred operations and failure colors. */
export function nativeDispatch<F extends (...args: never[]) => unknown>(
  fn: F,
  args: readonly unknown[]
): ReturnType<F> {
  return Reflect.apply(fn, undefined, args) as ReturnType<F>;
}

type LexicalCallback<A extends unknown[], Y, R> = ((...args: A) => R) & Iterable<Y>;

type LexicalPhase = "event" | "memo" | "compute" | "effect" | "hole";
type PhaseOps<M extends LexicalPhase> = M extends "event"
  ? EventOp
  : M extends "memo"
    ? MemoOp
    : M extends "compute"
      ? ComputeOp
      : M extends "effect"
        ? EffectPhaseOp
        : HoleOp;
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
