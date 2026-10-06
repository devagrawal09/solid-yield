// The room's failures, each its own color: an attempt's handler turns what it
// caught into one of these (the message is kept, so the UI shows the same text).
/** A message could not be sent: the color of a post's failure. */
export class SendError extends Error {
  readonly kind = "send" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/** The posted message did not reach the transcript in time: the color of its failure. */
export class DeliveryError extends Error {
  readonly kind = "delivery" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/** The dev-only chaos route failed: the color of its failure. */
export class ChaosError extends Error {
  readonly kind = "chaos" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/** Loading the room's archive failed: the color of its failure. */
export class ArchiveError extends Error {
  readonly kind = "archive" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
/** A live server source failed: the color of its failure. */
export class LiveError extends Error {
  readonly kind = "live" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
