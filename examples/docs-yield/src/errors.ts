import { Failure, registerFailure } from "solid-yield";
// Main's D-110 requires nominal library failures; preserve the original messages.
export class NotFound extends Failure("not-found") {
  readonly resource = "article";
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export class SearchError extends Failure("search-error") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export class RateLimited extends Failure("rate-limited") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export class BadEmail extends Failure("bad-email") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

// Distinct sibling for the streamed selective-boundary smoke.
export class ArticleUnavailable extends Failure("article-unavailable") {
  readonly resource = "article";
}
registerFailure(NotFound, "docs/NotFound");
registerFailure(SearchError, "docs/SearchError");
registerFailure(RateLimited, "docs/RateLimited");
registerFailure(BadEmail, "docs/BadEmail");
registerFailure(ArticleUnavailable, "docs/ArticleUnavailable");
