/** A stream of items failed: the color of its failure. */
export class StreamError extends Error {
  readonly kind = "stream" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/**
 * An item failed to load: the color of its failure. Its text is the
 * original's (`Error: …`, as `String(error)` shows it).
 */
export class ItemError extends Error {
  readonly kind = "item" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
