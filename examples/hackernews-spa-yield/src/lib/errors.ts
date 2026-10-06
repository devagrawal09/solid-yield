/** A Hacker News API request failed: the color of its failure. */
export class ApiError extends Error {
  readonly kind = "api" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
