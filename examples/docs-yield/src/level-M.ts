import { renderPost } from "./post-pipeline";
import type { Article } from "./api";
export function renderExtra(article: Article) {
  return article.kind === "post" ? renderPost(article) : undefined;
}
