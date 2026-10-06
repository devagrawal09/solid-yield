import { markSafeError } from "@solidjs/web";

/** D-110: typed failures are class instances, not structural Error shapes. */
const INSTANCE = Symbol("solid.yield.failure.instance");
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
  }
  toJSON() {
    return {
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
