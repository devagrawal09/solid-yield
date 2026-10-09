/*
 * Native `useContext` (F-S37), compiler-only.
 *
 * Solid 2's provider sets its value once, when it is created
 * (`setContext(provider, props.value)`), and `useContext` returns that value:
 * a native consumer holds the same value for its whole life, so reading it in
 * setup misses no update. A library setup's `yield* Ctx` gives a path instead,
 * because a library provider may give a source or a hole (D-098); the native
 * lowering takes the value itself, as Solid does, with the same requirement.
 *
 * Solid's `useContext` also throws when no provider (and no default) is above
 * it, before the author's own `if (!value) throw …` runs. That case is the
 * context's requirement (`ContextRead<Q>`), refused at a root or handoff that
 * leaves it unprovided. The guard itself raises only a value its declared type
 * admits: `nativeContextGuard` takes the value as TypeScript narrows it in the
 * guarded branch, and a branch narrowed to `never` raises nothing.
 */
import { raise, readContextValue } from "./runtime.js";
import type { ContextOps } from "./context.js";
import type { ContextRead, Raise, Yieldable } from "./types.js";

/** `const value = useContext(Ctx)`: the provided value, requiring `Ctx` when it has no default. */
export function nativeUseContext<T, N extends string, Q>(
  ctx: ContextOps<T, N, Q>
): Yieldable<ContextRead<Q>, T> {
  return {
    *[Symbol.iterator]() {
      return readContextValue(ctx) as T;
    }
  } as any;
}

/**
 * `if (!value) throw failure` right after a native `useContext`: `value` as the
 * guard narrows it. Narrowed to `never`, the branch cannot run under the
 * context's declared type and raises nothing; otherwise it raises `failure`.
 */
export function nativeContextGuard<V, E extends Error>(
  value: V,
  failure: E
): Yieldable<[V] extends [never] ? never : Raise<E>, never> {
  void value;
  return raise(failure as any) as any;
}
