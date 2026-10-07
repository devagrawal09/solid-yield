"use pure";
import { Marked } from "marked";
import { renderToString } from "katex";
import core from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import type { Article } from "./api";
import { escapeHtml, formatDate } from "./pipeline-utils";
export function renderPost(article: Article) {
  const highlighter = core.newInstance();
  for (const [name, grammar] of Object.entries({
    ts: typescript,
    js: javascript,
    bash,
    json,
    css,
    html: xml,
    python,
    rust,
    go
  }))
    highlighter.registerLanguage(name, grammar);
  const toc: { id: string; title: string; depth: number }[] = [];
  const parser = new Marked({
    async: false,
    gfm: true,
    renderer: {
      heading({ text, tokens, depth }) {
        const id = article.slug + "-" + toc.length;
        toc.push({ id, title: text, depth });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>`;
      },
      code({ text, lang }) {
        const language = lang?.split(/\s+/)[0] ?? "";
        if (language === "math")
          return renderToString(text, {
            displayMode: true,
            throwOnError: true,
            trust: false,
            output: "htmlAndMathml",
            macros: {}
          });
        const html = highlighter.getLanguage(language)
          ? highlighter.highlight(text, { language, ignoreIllegals: true }).value
          : escapeHtml(text);
        return `<pre><code class="hljs language-${escapeHtml(language)}">${html}</code></pre>`;
      }
    }
  });
  return {
    html: parser.parse(article.markdown, { async: false }),
    toc,
    date: formatDate(article.published)
  };
}
