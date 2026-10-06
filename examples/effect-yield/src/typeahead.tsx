// Read path: an Effect program consumed directly by a memo — examples/effect's
// typeahead with solid-yield.
//
// The memo routine returns the AsyncIterable `runEffect` builds, exactly as the
// original's memo does, so Solid still closes a superseded flight's iterator
// and `runEffect` interrupts the fiber. (`yield* attempt(…)` would not do: it
// awaits a promise, and a superseded run runs to completion with its result
// discarded (D-080) without telling the producer, so the fiber and its
// retries would run on.) The memo's source
// may be pending and fails as the stream's handler says; `Results` declares
// that coloring on its prop: `Source<Package[], SearchError | TransientError,
// true>`.
import {
  $component,
  $event,
  $memo,
  $signal,
  attempt,
  Errored,
  For,
  isPendingOf,
  latestOf,
  Loading,
  Show,
  type Source,
  type Props,
  view
} from "solid-yield";
import { searchPackages, TransientNetworkError, type Package } from "./api";
import { runEffect } from "./solid-effect";
import { SearchError, TransientError } from "./errors";

function formatDownloads(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

const Results = $component(function* Results(
  props: Props<{ results: Source<Package[], SearchError | TransientError, true>; query: string }>
) {
  // Solid's `latest` / `isPending`, as sources: stale while revalidating.
  const list = latestOf(props.results);
  const searching = isPendingOf(props.results);
  return view(function* () {
    return (
      <div class={{ results: true, stale: yield* searching }}>
        {
          yield* Show({
            when: function* () {
              return (yield* list).length > 0;
            },
            fallback: function* () {
              return (
                <p class="empty">
                  {(yield* searching) ? "Searching…" : `No packages match “${yield* props.query}”.`}
                </p>
              );
            },
            children: function* () {
              return (
                <ul>
                  {
                    yield* For({
                      each: list,
                      children: function* (pkg) {
                        return view(function* () {
                          return (
                            <li>
                              <div>
                                <span class="pkg-name">{yield* pkg.name}</span>
                                <span class="pkg-desc">{yield* pkg.description}</span>
                              </div>
                              <span class="pkg-downloads">
                                {formatDownloads(yield* pkg.downloads)}/wk
                              </span>
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
      </div>
    );
  });
});

export const Typeahead = $component(function* Typeahead() {
  const [query, setQuery] = yield* $signal("");

  // The whole data layer. searchPackages carries retry w/ backoff, timeout,
  // typed transient errors, and interruption finalizers — declared over
  // there, invisible here.
  const results = yield* $memo(function* () {
    const q = (yield* query).trim();
    if (!q) return [] as Package[];
    return yield* attempt(
      () => runEffect(searchPackages(q)),
      cause =>
        cause instanceof TransientNetworkError ? new TransientError(cause) : new SearchError(cause)
    );
  });
  const onInput = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
    yield* setQuery(e.currentTarget.value);
  });

  return view(function* () {
    return (
      <section class="panel">
        <header>
          <h2>Typeahead search</h2>
          <p>
            Each keystroke starts an Effect fiber (retry ×3 w/ exponential backoff, 4s timeout, ~35%
            transient failure rate). Superseded flights are <em>interrupted</em>, not ignored —
            Solid closes the stale iterator, <code>runEffect</code> interrupts the fiber.
          </p>
        </header>
        <input
          type="search"
          placeholder="Search packages… (try typing “solid” quickly)"
          value={yield* query}
          onInput={yield* onInput}
          autofocus
        />
        {
          yield* Show({
            when: function* () {
              return (yield* query).trim();
            },
            children: function* (q) {
              return view(function* () {
                // A boundary tag hands on nothing it does not handle, so the
                // Loading inside the Errored is a call; its children are a
                // getter so the results are created inside it.
                return (
                  <>
                    {
                      yield* Errored({
                        fallback: (err, reset) => (
                          <div class="error-box">
                            <p>Search gave up after retries: {String(err())}</p>
                            <button onClick={reset}>Try again</button>
                          </div>
                        ),
                        children: function* () {
                          return (
                            <>
                              {
                                yield* Loading({
                                  fallback: function* () {
                                    return <p class="loading">Searching…</p>;
                                  },
                                  children: function* () {
                                    return <>{yield* Results({ results, query: q })}</>;
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
            }
          })
        }
      </section>
    );
  });
});
