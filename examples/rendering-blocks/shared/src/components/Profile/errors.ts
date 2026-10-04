/** Loading the profile failed: the color of its failure. */
export class ProfileError extends Error {
  readonly kind = "profile" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
