import { markSafeError } from "@solidjs/web";

export class AckFailed extends Error {
  readonly kind = "ack-failed";
  constructor(message: string) {
    super(message);
    markSafeError(this);
  }
}

export class NotFound extends Error {
  readonly kind = "not-found";
  constructor(message: string) {
    super(message);
    markSafeError(this);
  }
}
