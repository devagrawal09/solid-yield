import type { Article } from "./api";
import type { renderArticle } from "./article-pipeline";
export function renderExtra(_article: Article): ReturnType<typeof renderArticle> | undefined {
  return undefined;
}
