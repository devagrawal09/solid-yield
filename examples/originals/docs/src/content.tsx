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
  return (
    <Errored
      fallback={err => (
        <p class="not-found">
          {(err() as NotFound).kind}: {(err() as NotFound).message}
        </p>
      )}
    >
      <Loading fallback="Loading article…">
        <ArticleBody article={article()} />
      </Loading>
    </Errored>
  );
}
function ArticleBody(props: { article: Article }) {
  return (
    <div class="reading">
      <article>
        <h1>{props.article.title}</h1>
        <p>{props.article.summary}</p>
        <section id={props.article.chapters[0].id}>
          <h2>{props.article.chapters[0].title}</h2>
          <p>{props.article.chapters[0].intro}</p>
          <p>{props.article.chapters[0].detail}</p>
          <pre>
            <code>{props.article.chapters[0].code}</code>
          </pre>
        </section>
        <section id={props.article.chapters[1].id}>
          <h2>{props.article.chapters[1].title}</h2>
          <p>{props.article.chapters[1].intro}</p>
          <p>{props.article.chapters[1].detail}</p>
          <pre>
            <code>{props.article.chapters[1].code}</code>
          </pre>
        </section>
        <section id={props.article.chapters[2].id}>
          <h2>{props.article.chapters[2].title}</h2>
          <p>{props.article.chapters[2].intro}</p>
          <p>{props.article.chapters[2].detail}</p>
          <pre>
            <code>{props.article.chapters[2].code}</code>
          </pre>
        </section>
        <section id={props.article.chapters[3].id}>
          <h2>{props.article.chapters[3].title}</h2>
          <p>{props.article.chapters[3].intro}</p>
          <p>{props.article.chapters[3].detail}</p>
          <pre>
            <code>{props.article.chapters[3].code}</code>
          </pre>
        </section>
        <section id={props.article.chapters[4].id}>
          <h2>{props.article.chapters[4].title}</h2>
          <p>{props.article.chapters[4].intro}</p>
          <p>{props.article.chapters[4].detail}</p>
          <pre>
            <code>{props.article.chapters[4].code}</code>
          </pre>
        </section>
        <section id={props.article.chapters[5].id}>
          <h2>{props.article.chapters[5].title}</h2>
          <p>{props.article.chapters[5].intro}</p>
          <p>{props.article.chapters[5].detail}</p>
          <pre>
            <code>{props.article.chapters[5].code}</code>
          </pre>
        </section>
        <section id={props.article.chapters[6].id}>
          <h2>{props.article.chapters[6].title}</h2>
          <p>{props.article.chapters[6].intro}</p>
          <p>{props.article.chapters[6].detail}</p>
          <pre>
            <code>{props.article.chapters[6].code}</code>
          </pre>
        </section>
        <section id={props.article.chapters[7].id}>
          <h2>{props.article.chapters[7].title}</h2>
          <p>{props.article.chapters[7].intro}</p>
          <p>{props.article.chapters[7].detail}</p>
          <pre>
            <code>{props.article.chapters[7].code}</code>
          </pre>
        </section>
      </article>
      <aside class="on-this-page">
        <h2>On this page</h2>
        <ol>
          <For each={props.article.chapters}>
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
