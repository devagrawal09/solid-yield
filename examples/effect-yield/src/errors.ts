import { Failure } from "solid-yield";
/** A package search failed: the color of its failure. */
export class SearchError extends Failure("search") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/**
 * A search's transient failure, after its retries: the color of the Effect
 * layer's `TransientNetworkError` (a tagged error, which has `_tag` but no
 * `kind`, D-034). It shows as the original does (`String(error)`).
 */
export class TransientError extends Failure("transient") {
  constructor(readonly error: Error) {
    super(error.message);
  }
  override toString(): string {
    return String(this.error);
  }
}
