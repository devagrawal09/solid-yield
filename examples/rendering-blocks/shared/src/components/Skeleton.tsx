import {
  $component,
  $event,
  $memo,
  $projection,
  $signal,
  attempt,
  For,
  isPendingOf,
  type Props,
  type Source,
  view
} from "@solidjs/blocks";

/** Fetching the feed failed: the color of its failure. */
export class FeedError extends Error {
  readonly kind = "feed" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

interface Feed {
  user: string;
  provisional?: boolean;
  items: { text: string }[];
}

// Default data, not a fallback tree: dummy items with the same shape and
// sentence structure as the real thing, rendered by the real template. The
// affordance is encoded in the data itself (`provisional`) — it drives a
// small inline indicator and dimmed text, nothing structural.
const placeholderFeed = (): Feed => ({
  user: "",
  provisional: true,
  items: [
    { text: "Shipped release #—" },
    { text: "Reviewed — pull requests" },
    { text: "Closed — issues" }
  ]
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let fetchCount = 0;
async function fetchFeed(): Promise<Feed> {
  await wait(1200);
  const run = ++fetchCount;
  return {
    user: "Ada",
    items: [
      { text: `Shipped release #${run}` },
      { text: `Reviewed ${run + 2} pull requests` },
      { text: `Closed ${run * 3} issues` }
    ]
  };
}

const FeedCard = $component(function* FeedCard(props: Props<{ feed: Source<Feed, FeedError> }>) {
  return view(function* () {
    return (
      <div
        class={["feed-card", { provisional: !!(yield* props.feed.provisional) }]}
        aria-busy={(yield* props.feed.provisional) ? "true" : "false"}
      >
        <h2>
          {(yield* props.feed.user) || "Someone"}'s activity
          <span class="loading-dot" />
        </h2>
        <ul>
          {
            yield* For({
              each: props.feed.items,
              children: function* (item) {
                return view(function* () {
                  return <li>{yield* item.text}</li>;
                });
              }
            })
          }
        </ul>
      </div>
    );
  });
});

const Skeleton = $component(function* Skeleton() {
  const [version, setVersion] = yield* $signal(0);

  // `loadingValue`: commit #0 is the placeholder, so the memo is never pending
  // on first read; the attempt declares no failure.
  const feed = yield* $memo(
    function* () {
      yield* version; // track: bumping refetches
      return yield* attempt(
        () => fetchFeed(),
        cause => new FeedError(cause)
      );
    },
    { loadingValue: placeholderFeed() }
  );

  // A derived store (`seedLoadingValue`: seeded, never pending): its body
  // reads the version (bumping refetches), waits, and fills the draft.
  const store = yield* $projection(
    function* (draft: Feed) {
      yield* version; // track: bumping refetches
      const data = yield* attempt(
        () => fetchFeed(),
        cause => new FeedError(cause)
      );
      draft.user = data.user;
      draft.items = data.items;
      draft.provisional = false;
    },
    placeholderFeed(),
    { seedLoadingValue: true }
  );
  const refreshing = isPendingOf(feed);
  const storeRefreshing = isPendingOf(store.items);
  const refetch = $event(function* () {
    yield* setVersion(v => v + 1);
  });

  return view(function* () {
    return (
      <section class={["feed", { pending: (yield* refreshing) || (yield* storeRefreshing) }]}>
        <h1>Loading Value</h1>
        <p>
          Both cards declare commit #0 — the memo via <code>loadingValue</code>, the derived store
          via <code>seedLoadingValue</code>. This is the "default data" pattern: the real template
          renders real-looking dummy items from frame one, and the loading affordance is encoded in
          the data itself (a <code>provisional</code> flag driving the dot and dimmed text) — there
          is no fallback tree and nothing suspends. During SSR the dummy items are what stream in
          the shell; on client navigation the page mounts fresh and opens a new loading window.
          Refetches are different: the question is already answered, so <code>isPending</code> dims
          the section instead.
        </p>
        <div style={{ display: "flex", gap: "2em", "flex-wrap": "wrap" }}>
          <div>
            <h2>createMemo + loadingValue</h2>
            {yield* FeedCard({ feed: feed })}
          </div>
          <div>
            <h2>createStore + seedLoadingValue</h2>
            {yield* FeedCard({ feed: store })}
          </div>
        </div>
        <button type="button" onClick={refetch}>
          Refetch
        </button>
      </section>
    );
  });
});

export default Skeleton;
