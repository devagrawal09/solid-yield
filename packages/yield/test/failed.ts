import { Failure } from "solid-yield";
/**
 * The tests' failure type: an attempt's handler turns what failed into a
 * `Failed` (an `Error` with a literal `kind`, as every failure type needs,
 * D-034), keeping the message and the cause.
 */
export class Failed extends Failure("failed") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}
/** An attempt's handler in these tests: what failed, as a `Failed`. */
export const toFailed = (e: unknown): Failed => (e instanceof Failed ? e : new Failed(e));
