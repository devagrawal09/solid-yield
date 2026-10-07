import { renderPage as renderArticle } from "./page-pipeline";
import {
  component,
  $memo,
  attempt,
  For,
  Loading,
  Errored,
  type Source,
  type Props,
  view
} from "solid-yield";
import { getSite, getArticle, type Article, type Site } from "./api";
import { NotFound } from "./errors";
export const SiteNav = component(function* SiteNav() {
  const site = yield* $memo(function* () {
    return yield* attempt(
      () => getSite(),
      cause => new NotFound(cause)
    );
  });
  return view(function* () {
    return (
      <>
        {
          yield* Loading({
            fallback: "Loading navigation…",
            children: function* () {
              return <>{yield* NavTree({ site })}</>;
            }
          })
        }
      </>
    );
  });
});
const NavTree = component(function* NavTree(props: Props<{ site: Source<Site, NotFound, true> }>) {
  return view(function* () {
    return (
      <nav aria-label="Documentation">
        <h2>{yield* props.site.title}</h2>
        <p>{yield* props.site.intro}</p>
        <ul>
          {
            yield* For({
              each: props.site.navigation,
              children: function* (group) {
                return view(function* () {
                  return (
                    <li>
                      <h3>{yield* group.title}</h3>
                      <ul>
                        {
                          yield* For({
                            each: group.links,
                            children: function* (link) {
                              return view(function* () {
                                return (
                                  <li>
                                    <a href={yield* link.href}>{yield* link.title}</a>
                                  </li>
                                );
                              });
                            }
                          })
                        }
                      </ul>
                    </li>
                  );
                });
              }
            })
          }
        </ul>
      </nav>
    );
  });
});
export const SiteFooter = component(function* SiteFooter() {
  const site = yield* $memo(function* () {
    return yield* attempt(
      () => getSite(),
      cause => new NotFound(cause)
    );
  });
  return view(function* () {
    return (
      <footer>
        {
          yield* Loading({
            fallback: "Loading footer…",
            children: function* () {
              return <>{yield* FooterLinks({ site })}</>;
            }
          })
        }
      </footer>
    );
  });
});
const FooterLinks = component(function* FooterLinks(
  props: Props<{ site: Source<Site, NotFound, true> }>
) {
  return view(function* () {
    return (
      <>
        <p>{yield* props.site.footer}</p>
        <ul>
          {
            yield* For({
              each: props.site.links,
              children: function* (link) {
                return view(function* () {
                  return (
                    <li>
                      <a href={yield* link.href}>{yield* link.title}</a>
                    </li>
                  );
                });
              }
            })
          }
        </ul>
      </>
    );
  });
});
export const ArticleContent = component(function* ArticleContent(
  props: Props<{ slug: string | undefined }>
) {
  const article = yield* $memo(function* () {
    const slug = (yield* props.slug) ?? "overview";
    return yield* attempt(
      () => getArticle(slug),
      cause => new NotFound(cause)
    );
  });
  const rendered = yield* $memo(function* () {
    return renderArticle(yield* article);
  });
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            catch: [NotFound],
            fallback: err => (
              <p class="not-found">
                {err().kind}: {err().message}
              </p>
            ),
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: "Loading article…",
                      children: function* () {
                        return <>{yield* ArticleBody({ article, rendered })}</>;
                      }
                    })
                  }
                </>
              );
            }
          })
        }
      </>
    );
  });
});
const ArticleBody = component(function* ArticleBody(
  props: Props<{
    article: Source<Article, NotFound, true>;
    rendered: Source<ReturnType<typeof renderArticle>, NotFound, true>;
  }>
) {
  return view(function* () {
    return (
      <div class="reading">
        <article>
          <h1>{yield* props.article.title}</h1>
          <p>{yield* props.article.summary}</p>
          <time datetime={yield* props.article.published}>{yield* props.rendered.date}</time>
          <div class="markdown" innerHTML={yield* props.rendered.html} />
        </article>
        <aside class="on-this-page">
          <h2>On this page</h2>
          <ol>
            {
              yield* For({
                each: function* () {
                  return yield* props.rendered.toc;
                },
                children: function* (chapter) {
                  return view(function* () {
                    return (
                      <li>
                        <a href={`#${(yield* chapter).id}`}>{(yield* chapter).title}</a>
                      </li>
                    );
                  });
                }
              })
            }
          </ol>
        </aside>
        <section class="related">
          <h2>Related reading</h2>
          <ul>
            {
              yield* For({
                each: props.article.related,
                children: function* (link) {
                  return view(function* () {
                    return (
                      <li>
                        <a href={yield* link.href}>{yield* link.title}</a>
                      </li>
                    );
                  });
                }
              })
            }
          </ul>
        </section>
      </div>
    );
  });
});

// Long, server-derived reference content lives outside the route's owner.
export const ReadingGuide = component(function* ReadingGuide() {
  return view(function* () {
    return (
      <section class="reading-guide">
        <h2>Reading guide</h2>
        {yield* ArticleContent({ slug: "widgets" })}
      </section>
    );
  });
});
