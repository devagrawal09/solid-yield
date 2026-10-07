import type { Article, Site } from "./api";
export const extraArticles: Record<string, Pick<Article, "title" | "markdown" | "kind">> = {};
export const extraNavigation: Site["navigation"] = [];
