"use pure";
import { html as diffHtml } from "diff2html";
import { escapeHtml as esc, formatDate } from "./pipeline-utils";
import type { Article } from "./api";
type Release = { version: string; date: string; summary: string; diff: string };
export function renderChangelog(article: Article) {
  const releases: Release[] = JSON.parse(article.markdown);
  const toc = releases.map(r => ({
    id: "release-" + r.version.replaceAll(".", "-"),
    title: r.version,
    depth: 2
  }));
  const html = releases
    .map(
      (r, i) =>
        `<section class="release" id="${toc[i].id}"><h2>${esc(r.version)}</h2><time datetime="${esc(r.date)}">${formatDate(r.date)}</time><p>${esc(r.summary)}</p>${diffHtml(r.diff, { drawFileList: false, matching: "lines", outputFormat: "line-by-line", renderNothingWhenEmpty: false })}</section>`
    )
    .join("");
  return { html, toc, date: formatDate(article.published) };
}
