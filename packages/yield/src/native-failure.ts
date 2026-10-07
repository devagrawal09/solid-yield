/** Compiler-only adapters. Authors keep native class/value throws. */
import { FailureInstance } from "./failure.js";
import type { ChunkError } from "./lazy.js";
const identities = new WeakMap<Function, string>();
export function registerNativeFailure<T extends Function>(id: string, constructor: T): T {
  identities.set(constructor, id);
  return constructor;
}
export class NativeFailure<K extends string> extends FailureInstance<K> {
  constructor(
    kind: K,
    readonly value: unknown
  ) {
    super(kind, value instanceof Error ? value.message : String(value));
    this.name = "NativeFailure";
  }
  override toJSON() {
    return { ...super.toJSON(), value: this.value };
  }
}
export type NativeCaught<K extends string> = K extends "ChunkError" ? ChunkError : NativeFailure<K>;
/** The literal kinds are a compiler witness, checked against throw/call inference. */
export function nativeFailure<const K extends string>(
  kinds: readonly K[],
  value: unknown,
  transport?: new (cause: unknown) => ChunkError
): NativeCaught<K> {
  if (transport && value instanceof transport && kinds.includes("ChunkError" as K))
    return value as NativeCaught<K>;
  const wire = value as { name?: string; kind?: string; value?: unknown } | null;
  if (wire?.name === "NativeFailure" && kinds.includes(wire.kind as K))
    return new NativeFailure(wire.kind!, wire.value) as NativeCaught<K>;
  const constructor =
    value != null && (typeof value === "object" || typeof value === "function")
      ? (value as object).constructor
      : null;
  const builtin =
    constructor &&
    [
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      ReferenceError,
      URIError,
      EvalError,
      AggregateError
    ].includes(constructor as ErrorConstructor)
      ? `global:${constructor.name}`
      : undefined;
  let identity = constructor && (identities.get(constructor) ?? builtin);
  // A value typed as a base class may be a subclass at run time.
  for (
    let prototype =
      value != null && typeof value === "object" ? Object.getPrototypeOf(value) : null;
    prototype && (!identity || !kinds.includes(identity as K));
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const declared = identities.get(prototype.constructor);
    if (declared && kinds.includes(declared as K)) identity = declared;
  }
  if (identity && kinds.includes(identity as K))
    return new NativeFailure(identity, value) as NativeCaught<K>;
  if (kinds.includes("unknown" as K)) return new NativeFailure("unknown", value) as NativeCaught<K>;
  if (transport && kinds.includes("ChunkError" as K))
    return new transport(value) as NativeCaught<K>;
  // A broken compiler/external contract is never relabeled as a known class.
  throw new Error("[NATIVE_FAILURE_CONTRACT] A rejection is outside the inferred failure set.", {
    cause: value
  });
}
export function nativeFailureValue(value: unknown): unknown {
  return value instanceof NativeFailure ? value.value : value;
}
