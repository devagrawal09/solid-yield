import { markSafeError } from "@solidjs/web";
// Plain Solid's local failure factory opts public API failures into serialization.
function Failure<K extends string>(kind: K) {
  return class extends Error {
    readonly kind = kind;
    constructor(cause: unknown) {
      super(cause instanceof Error ? cause.message : String(cause));
      markSafeError(this);
    }
  };
}
export class NotFound extends Failure("not-found") {}
export class SearchError extends Failure("search-error") {}
export class RateLimited extends Failure("rate-limited") {}
export class BadEmail extends Failure("bad-email") {}
