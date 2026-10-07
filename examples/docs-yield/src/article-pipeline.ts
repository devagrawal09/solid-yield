import { Marked } from "marked";
import core from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import type { Article } from "./api";

// Repository-authored Markdown only. This is not an untrusted-HTML sanitizer.
// Each call owns its renderer, language registry and heading counters.
export function renderArticle(article: Article) {
  const highlighter = core.newInstance();
  highlighter.registerLanguage("ts", typescript);
  highlighter.registerLanguage("js", javascript);
  highlighter.registerLanguage("sh", bash);
  const toc: { id: string; title: string; depth: number }[] = [];
  const counts = new Map<string, number>();
  const escape = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const parser = new Marked({
    async: false,
    gfm: true,
    renderer: {
      heading({ text, tokens, depth }) {
        const base =
          article.slug +
          "-" +
          text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const count = (counts.get(base) ?? 0) + 1;
        counts.set(base, count);
        const id = count === 1 ? base : base + "-" + count;
        toc.push({ id, title: text, depth });
        return `<h${depth} id="${escape(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = lang?.split(/\s+/)[0] ?? "";
        const known = ["ts", "js", "sh"].includes(language);
        const html = known
          ? highlighter.highlight(text, { language, ignoreIllegals: true }).value
          : escape(text);
        return `<pre><code class="hljs language-${escape(language)}">${html}</code></pre>\n`;
      }
    }
  });
  const html = parser.parse(article.markdown, { async: false });
  const date = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(article.published));
  return { html, toc, date };
}
