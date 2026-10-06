import {
  component,
  $signal,
  $optimistic,
  $memo,
  $effect,
  $event,
  attempt,
  Loading,
  Errored,
  For,
  type Props,
  view
} from "solid-yield";
import { search, like, subscribe, comments, avatar } from "./api";
import { SearchError, RateLimited, BadEmail } from "./errors";

export const ThemeToggle = component(function* ThemeToggle() {
  const [dark, setDark] = yield* $signal(false);
  // Deliberate D-104 eager cause. The class is confined to this wrapper.
  yield* $effect(
    function* () {
      return yield* dark;
    },
    function* () {}
  );
  const toggle = $event(function* () {
    yield* setDark(!(yield* dark));
  });
  return view(function* () {
    return (
      <section class={(yield* dark) ? "widget theme dark" : "widget theme"}>
        <button onClick={yield* toggle}>Theme: {(yield* dark) ? "dark" : "light"}</button>
      </section>
    );
  });
});

export const SearchBox = component(function* SearchBox() {
  const [query, setQuery] = yield* $signal("");
  const edit = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
    yield* setQuery(e.currentTarget.value);
  });
  const results = yield* $memo(function* () {
    const value = yield* query;
    return yield* attempt(
      () => search(value),
      cause => new SearchError(cause)
    );
  });
  return view(function* () {
    return (
      <section class="widget search">
        <h2>Search</h2>
        <input aria-label="Search docs" value={yield* query} onInput={yield* edit} />
        {
          yield* Errored({
            catch: [SearchError],
            fallback: err => (
              <p class="search-error">
                {err().kind}: {err().message}
              </p>
            ),
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: "Searching…",
                      children: function* () {
                        return (
                          <ul>
                            {
                              yield* For({
                                each: results,
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
                        );
                      }
                    })
                  }
                </>
              );
            }
          })
        }
      </section>
    );
  });
});

export const LikeButton = component(function* LikeButton(
  props: Props<{ slug: string | undefined }>
) {
  const [count, setCount] = yield* $signal(0);
  const [optimistic, setOptimistic] = yield* $optimistic(0);
  const [pending, setPending] = yield* $optimistic(false);
  const [failure, setFailure] = yield* $signal<RateLimited | null>(null);
  const add = $event(function* () {
    const next = (yield* count) + 1;
    const slug = (yield* props.slug) ?? "overview";
    yield* setOptimistic(1);
    yield* setPending(true);
    const saved = yield* attempt(
      () => like(slug, next),
      function* (cause) {
        yield* setFailure(new RateLimited(cause));
      }
    );
    if (saved !== undefined) {
      yield* setCount(saved);
      yield* setFailure(null);
    }
  });
  return view(function* () {
    return (
      <section class="widget like">
        <button disabled={yield* pending} onClick={yield* add}>
          Like: {(yield* count) + (yield* optimistic)}
        </button>
        <span>{(yield* pending) ? " Saving…" : ""}</span>
        <p class="like-error">
          {(yield* failure)?.kind ?? ""}
          {(yield* failure) ? ": " : ""}
          {(yield* failure)?.message ?? ""}
        </p>
      </section>
    );
  });
});

export const NewsletterForm = component(function* NewsletterForm() {
  const [email, setEmail] = yield* $signal("");
  const [message, setMessage] = yield* $signal("");
  const [failure, setFailure] = yield* $signal<BadEmail | null>(null);
  const [pending, setPending] = yield* $optimistic(false);
  const edit = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
    yield* setEmail(e.currentTarget.value);
  });
  const submit = $event(function* (e: SubmitEvent) {
    e.preventDefault();
    const value = yield* email;
    yield* setPending(true);
    const saved = yield* attempt(
      () => subscribe(value),
      function* (cause) {
        yield* setFailure(new BadEmail(cause));
        yield* setMessage("");
      }
    );
    if (saved !== undefined) {
      yield* setMessage(saved);
      yield* setFailure(null);
    }
  });
  return view(function* () {
    return (
      <form class="widget newsletter" novalidate onSubmit={yield* submit}>
        <h2>Newsletter</h2>
        <input name="email" aria-label="Email" value={yield* email} onInput={yield* edit} />
        <button disabled={yield* pending}>{(yield* pending) ? "Subscribing…" : "Subscribe"}</button>
        <p class="newsletter-message">{yield* message}</p>
        <p class="newsletter-error">
          {(yield* failure)?.kind ?? ""}
          {(yield* failure) ? ": " : ""}
          {(yield* failure)?.message ?? ""}
        </p>
      </form>
    );
  });
});

export const CommentList = component(function* CommentList() {
  const rows = yield* $memo(function* () {
    return yield* attempt(
      () => comments(),
      () => []
    );
  });
  return view(function* () {
    return (
      <section class="widget comments">
        <h2>Reader notes</h2>
        {
          yield* Loading({
            fallback: "Loading comments…",
            children: function* () {
              return (
                <ul>
                  {
                    yield* For({
                      each: rows,
                      children: function* (row) {
                        const picture = yield* $memo(function* () {
                          const id = yield* row.id;
                          return yield* attempt(
                            () => avatar(id),
                            () => ""
                          );
                        });
                        return view(function* () {
                          return (
                            <li>
                              {
                                yield* Loading({
                                  fallback: function* () {
                                    return <span class="avatar-pending">Avatar…</span>;
                                  },
                                  children: function* () {
                                    return (
                                      <img width="24" height="24" alt="" src={yield* picture} />
                                    );
                                  }
                                })
                              }
                              <b>{yield* row.name}</b>
                              <p>{yield* row.text}</p>
                            </li>
                          );
                        });
                      }
                    })
                  }
                </ul>
              );
            }
          })
        }
      </section>
    );
  });
});

const pictures = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='teal'/%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='coral'/%3E%3C/svg%3E"
];
export const ImageCarousel = component(function* ImageCarousel() {
  const [index, setIndex] = yield* $signal(0);
  const next = $event(function* () {
    yield* setIndex(((yield* index) + 1) % pictures.length);
  });
  return view(function* () {
    return (
      <section class="widget carousel">
        <h2>Examples in pictures</h2>
        <img src={pictures[yield* index]} alt={`Example ${(yield* index) + 1}`} />
        <p>Image {(yield* index) + 1} of 2</p>
        <button onClick={yield* next}>Next image</button>
      </section>
    );
  });
});
