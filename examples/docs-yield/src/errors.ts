import { Failure } from "solid-yield";
// Main's D-110 requires nominal library failures; preserve the original messages.
export class NotFound extends Failure("not-found") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export class SearchError extends Failure("search-error") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export class RateLimited extends Failure("rate-limited") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export class BadEmail extends Failure("bad-email") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
