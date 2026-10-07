import { renderPage as renderArticle } from "./page-pipeline";
import { createMemo, For, Loading, Errored } from "solid-js";
import { getSite, getArticle, type Article } from "./api";
import { NotFound } from "./errors";
export function SiteNav() {
  const site = createMemo(() => getSite());
  return (
    <Loading fallback="Loading navigation…">
      <nav aria-label="Documentation">
        <h2>{site().title}</h2>
        <p>{site().intro}</p>
        <ul>
          <For each={site().navigation}>
            {group => (
              <li>
                <h3>{group.title}</h3>
                <ul>
                  <For each={group.links}>
                    {link => (
                      <li>
                        <a href={link.href}>{link.title}</a>
                      </li>
                    )}
                  </For>
                </ul>
              </li>
            )}
          </For>
        </ul>
      </nav>
    </Loading>
  );
}
export function SiteFooter() {
  const site = createMemo(() => getSite());
  return (
    <footer>
      <Loading fallback="Loading footer…">
        <p>{site().footer}</p>
        <ul>
          <For each={site().links}>
            {link => (
              <li>
                <a href={link.href}>{link.title}</a>
              </li>
            )}
          </For>
        </ul>
      </Loading>
    </footer>
  );
}
export function ArticleContent(props: { slug: string | undefined }) {
  const article = createMemo(() => getArticle(props.slug ?? "overview"));
  const rendered = createMemo(() => renderArticle(article()));
  return (
    <Errored
      fallback={err => (
        <p class="not-found">
          {(err() as NotFound).kind}: {(err() as NotFound).message}
        </p>
      )}
    >
      <Loading fallback="Loading article…">
        <ArticleBody article={article()} rendered={rendered()} />
      </Loading>
    </Errored>
  );
}
function ArticleBody(props: { article: Article; rendered: ReturnType<typeof renderArticle> }) {
  return (
    <div class="reading">
      <article>
        <h1>{props.article.title}</h1>
        <p>{props.article.summary}</p>
        <time datetime={props.article.published}>{props.rendered.date}</time>
        <div class="markdown" innerHTML={props.rendered.html} />
      </article>
      <aside class="on-this-page">
        <h2>On this page</h2>
        <ol>
          <For each={props.rendered.toc}>
            {chapter => (
              <li>
                <a href={`#${chapter.id}`}>{chapter.title}</a>
              </li>
            )}
          </For>
        </ol>
      </aside>
      <section class="related">
        <h2>Related reading</h2>
        <ul>
          <For each={props.article.related}>
            {link => (
              <li>
                <a href={link.href}>{link.title}</a>
              </li>
            )}
          </For>
        </ul>
      </section>
    </div>
  );
}

export function ReadingGuide() {
  return (
    <section class="reading-guide">
      <h2>Reading guide</h2>
      <ArticleContent slug="widgets" />
    </section>
  );
}
