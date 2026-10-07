import { renderPost } from "./post-pipeline";
import { renderApi } from "./api-pipeline";
import { renderChangelog } from "./changelog-pipeline";
import type { Article } from "./api";
export function renderExtra(article: Article) {
  if (article.kind === "post") return renderPost(article);
  if (article.kind === "api") return renderApi(article);
  if (article.kind === "changelog") return renderChangelog(article);
}
