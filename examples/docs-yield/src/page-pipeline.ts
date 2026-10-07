"use pure";
import { renderArticle } from "./article-pipeline";
import { renderExtra } from "./level-pipelines";
import type { Article } from "./api";
export function renderPage(article: Article) {
  return renderExtra(article) ?? renderArticle(article);
}
