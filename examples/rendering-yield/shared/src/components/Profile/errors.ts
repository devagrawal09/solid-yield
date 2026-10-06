import { Failure } from "solid-yield";
/** Loading the profile failed: the color of its failure. */
export class ProfileError extends Failure("profile") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
