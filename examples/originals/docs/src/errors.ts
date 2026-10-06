// The library exports a structural Failure type, not a class factory.
// This local factory gives each API failure its own class and literal kind.
function Failure<K extends string>(kind: K) {
  return class extends Error {
    readonly kind = kind;
    constructor(cause: unknown) {
      super(cause instanceof Error ? cause.message : String(cause));
    }
  };
}
export class NotFound extends Failure("not-found") {}
export class SearchError extends Failure("search-error") {}
export class RateLimited extends Failure("rate-limited") {}
export class BadEmail extends Failure("bad-email") {}
