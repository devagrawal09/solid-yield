/*
 * Native lowering: a library setter where the author's types expect a plain
 * function — a context value's `setRange: (range: Range) => void`, a callback
 * prop typed `(value: T) => void`. A library setter writes when its receipt is
 * delegated to (`yield* setX(v)`); the author's Solid setter wrote when it was
 * called, and a plain function type gives the caller no receipt to delegate
 * to. `nativeWrite(setX)` writes when called, by delegating to the receipt
 * there. The runtime checks the write where it runs: in an `$event` or an
 * `$effect`'s effect phase (`WRITE_IN_REACTIVE` elsewhere, `SETTER_OUTSIDE_RUN`
 * with no routine running, D-028), as it checks every write.
 */
import { devError } from "./runtime.js";
import type { Receipt } from "./types.js";

/** @internal */
export function nativeWrite<A extends unknown[], T>(
  setter: (...args: A) => Receipt<T>
): (...args: A) => T {
  return (...args: A): T => {
    const step = setter(...args)
      [Symbol.iterator]()
      .next();
    if (!step.done)
      throw devError("NATIVE_WRITE", "a setter's receipt yielded an operation; it only writes");
    return step.value;
  };
}
