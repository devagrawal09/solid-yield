import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { renderArticle } from "../src/article-pipeline";
import { getArticle } from "../src/api";

it("keeps the twins' six Markdown sources and pipeline identical", async () => {
  for (const name of [
    "article-pipeline.ts",
    "api.ts",
    ...["overview", "start", "widgets", "pipeline", "routing", "testing"].map(
      s => `articles/${s}.md`
    )
  ]) {
    expect(readFileSync(resolve(process.cwd(), "src", name), "utf8")).toBe(
      readFileSync(resolve(process.cwd(), "../originals/docs/src", name), "utf8")
    );
  }
  const article = await getArticle("pipeline");
  const before = structuredClone(article);
  const first = renderArticle(article);
  renderArticle(await getArticle("widgets"));
  expect(renderArticle(article)).toEqual(first);
  expect(article).toEqual(before);
  expect(first.toc).toHaveLength(6);
  expect(first.html).toContain('class="hljs-keyword">interface</span>');
  expect(first.html).toContain("<table>");
  const repeated = renderArticle({ ...article, markdown: "## Same\n\n## Same\n" });
  expect(repeated.toc.map(h => h.id)).toEqual(["pipeline-same", "pipeline-same-2"]);
});
