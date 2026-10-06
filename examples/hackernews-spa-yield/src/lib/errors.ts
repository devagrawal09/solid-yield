import { Failure } from "solid-yield";
/** A Hacker News API request failed: the color of its failure. */
export class ApiError extends Failure("api") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
