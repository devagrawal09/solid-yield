export class ApiError extends Error {}
export class NotFound extends ApiError {
  constructor(public id: string) { super("not found " + id); }
}
export class RateLimited extends ApiError {
  constructor(public retryAfter: number) { super("rate limited"); }
}
