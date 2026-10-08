import { isSafeError, markSafeError } from "@solidjs/web";

/** D-110: typed failures are class instances, not structural Error shapes. */
const INSTANCE = Symbol("solid.yield.failure.instance");
const WIRE_CLASS = "$yieldFailure";
export type FailureClass = abstract new (...args: any[]) => Error;
const classes = new Map<string, FailureClass>();
const ids = new WeakMap<FailureClass, string>();

/** Register at module scope in both builds. IDs must be stable and unique. */
export function registerFailure<C extends FailureClass>(Class: C, id: string): C {
  if (!id || ((Class as Function) !== Error && !(Class.prototype instanceof Error)))
    throw new TypeError("registerFailure needs an Error class and a nonempty wire ID");
  if ((classes.has(id) && classes.get(id) !== Class) || (ids.has(Class) && ids.get(Class) !== id))
    throw new TypeError(`Failure wire ID already registered: ${id}`);
  classes.set(id, Class);
  ids.set(Class, id);
  return Class;
}

/** Look up an exact wire ID; kinds and constructor names are not class IDs. */
export function failureClass(id: string): FailureClass | undefined {
  return classes.get(id);
}

/**
 * Native emit calls this before transporting a registered author Error. Frozen
 * values are copied; the caller must use the returned value. Unregistered
 * crashes are untouched. Registration alone does not mark native constructors.
 */
export function prepareFailure<T extends Error>(error: T): T {
  const Class = Object.getPrototypeOf(error)?.constructor as FailureClass;
  const id = ids.get(Class);
  if (!id) return error;
  const current = Object.getOwnPropertyDescriptor(error, WIRE_CLASS);
  let out = error;
  if (!Object.isExtensible(error) || (current && !current.configurable && current.value !== id)) {
    const descriptors = Object.getOwnPropertyDescriptors(error);
    delete descriptors[WIRE_CLASS];
    out = Object.create(Object.getPrototypeOf(error), descriptors);
  }
  if (!current || current.value !== id || out !== error)
    Object.defineProperty(out, WIRE_CLASS, { value: id, enumerable: true, configurable: true });
  if (!isSafeError(out)) markSafeError(out);
  if ((out as any)[Symbol.for("solid.blocks.failure")] !== true)
    Object.defineProperty(out, Symbol.for("solid.blocks.failure"), {
      value: true,
      configurable: true
    });
  return out;
}

/**
 * Restore only registered prototypes, without running a constructor. Solid's
 * stream and RPC codecs preserve Error own enumerable properties, not its
 * custom prototype. Unknown IDs remain nominal unknown failures; originalKind
 * retains the server's kind. Ordinary crashes are left alone.
 */
export function rehydrateFailure(value: unknown): unknown {
  if (!value || typeof value !== "object" || value instanceof FailureInstance) return value;
  const data = value as Record<string, unknown>;
  if (
    !Object.hasOwn(data, WIRE_CLASS) ||
    typeof data[WIRE_CLASS] !== "string" ||
    typeof data.message !== "string"
  )
    return value;
  const Class = classes.get(data[WIRE_CLASS]);
  // A caller may freeze a decoded value. Copy its own descriptors in that case.
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!Class) {
    delete descriptors.kind;
    delete descriptors.originalKind;
  }
  const out =
    Object.isExtensible(value) && Class
      ? value
      : Object.create(Object.getPrototypeOf(value), descriptors);
  Object.setPrototypeOf(out, Class ? Class.prototype : FailureInstance.prototype);
  if (!Class) {
    Object.defineProperty(out, "originalKind", {
      value: data.kind,
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(out, "kind", { value: "unknown", enumerable: true, configurable: true });
  }
  if (!isSafeError(out)) markSafeError(out);
  if ((out as any)[Symbol.for("solid.blocks.failure")] !== true)
    Object.defineProperty(out, Symbol.for("solid.blocks.failure"), {
      value: true,
      configurable: true
    });
  return out;
}
export class FailureInstance<K extends string> extends Error {
  private readonly [INSTANCE] = true;
  constructor(
    readonly kind: K,
    message?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    // D-115: their kind and message are part of the public failure contract.
    markSafeError(this);
    Object.defineProperty(this, WIRE_CLASS, {
      value: ids.get(new.target as FailureClass) ?? "",
      enumerable: true
    });
  }
  toJSON() {
    return {
      ...this,
      name: this.name,
      message: this.message,
      kind: this.kind,
      ...(this.cause === undefined ? {} : { cause: this.cause })
    };
  }
}
export interface Failure<K extends string = string> extends FailureInstance<K> {}
/** Declare a failure in one line: class Boom extends Failure("boom") {}. */
export function Failure<const K extends string>(
  kind: K
): new (message?: string, options?: ErrorOptions) => Failure<K> {
  return class extends FailureInstance<K> {
    constructor(message?: string, options?: ErrorOptions) {
      super(kind, message, options);
    }
  };
}

// Object.freeze preserves the prototype and private instance identity.
// Readonly<T> alone would erase TypeScript's private members.
declare global {
  interface ObjectConstructor {
    freeze<T extends Failure>(value: T): T & Readonly<T>;
  }
}
