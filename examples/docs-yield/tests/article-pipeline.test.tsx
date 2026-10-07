import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { renderArticle } from "../src/article-pipeline";
import { getArticle } from "../src/api";

it("keeps the twins' six Markdown sources and pipeline identical", async () => {
  for (const name of [
    "article-pipeline.ts",
    "page-pipeline.ts",
    "post-pipeline.ts",
    "api-pipeline.ts",
    "changelog-pipeline.ts",
    "pipeline-utils.ts",
    "level-pipelines.ts",
    "level-data.ts",
    "level-S.ts",
    "level-M.ts",
    "data-S.ts",
    "data-M.ts",
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

// Determinism checks support the author assertion; they are not a purity proof.
it("renders all content pipelines with stable local state and valid references", async () => {
  const { renderPage } = await import("../src/page-pipeline");
  const { extraArticles } = await import("../src/level-data");
  for (const slug of Object.keys(extraArticles)) {
    const article = await getArticle(slug);
    const before = structuredClone(article);
    const first = renderPage(article);
    renderPage(await getArticle("pipeline"));
    expect(renderPage(article)).toEqual(first);
    expect(article).toEqual(before);
    expect(first.html.length).toBeGreaterThan(100);
    if (article.kind === "post") expect(first.html).toContain('class="katex"');
    if (article.kind === "api") {
      expect(first.toc).toHaveLength(20);
      expect(first.html).toContain('href="#api-author"');
      expect(first.html).toContain("AuthorSchema");
      expect(() =>
        renderPage({
          ...article,
          markdown: JSON.stringify({ $defs: { Broken: { $ref: "#/$defs/Absent" } } })
        })
      ).toThrow("Unknown API entry");
    }
    if (article.kind === "changelog") {
      expect(first.toc).toHaveLength(8);
      expect(first.html).toContain("d2h-ins");
    }
  }
});
