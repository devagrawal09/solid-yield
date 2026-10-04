/** A package search failed: the color of its failure. */
export class SearchError extends Error {
  readonly kind = "search" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/**
 * A search's transient failure, after its retries: the color of the Effect
 * layer's `TransientNetworkError` (a tagged error, which has `_tag` but no
 * `kind`, D-034). It shows as the original does (`String(error)`).
 */
export class TransientError extends Error {
  readonly kind = "transient" as const;
  constructor(readonly error: Error) {
    super(error.message);
  }
  override toString(): string {
    return String(this.error);
  }
}
