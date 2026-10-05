import {
  $component,
  $memo,
  $projection,
  attempt,
  For,
  Loading,
  Repeat,
  type Path,
  type Source,
  type Props,
  view
} from "solid-blocks";
import { StreamError } from "./errors";

interface StreamItem {
  id: number;
  text: string;
}

async function* getData(): AsyncIterable<StreamItem> {
  const items: StreamItem[] = [
    { id: 1, text: "First item" },
    { id: 2, text: "Second item" },
    { id: 3, text: "Third item" },
    { id: 4, text: "Fourth item" },
    { id: 5, text: "Fifth item" }
  ];

  for (const item of items) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    yield item;
  }
}

/** The original memo's body: an immutable array per yield. */
async function* accumulate(): AsyncIterable<StreamItem[]> {
  let accum: StreamItem[] = [];
  for await (const val of getData()) {
    yield (accum = [...accum, val]);
  }
}

// What each `<Loading>` covers is its own component (a view that reads a
// pending source is pending).
const MemoList = $component(function* MemoList(
  props: Props<{ items: Source<StreamItem[], StreamError, true> }>
) {
  return view(function* () {
    return (
      <ul id="memo-list">
        {
          yield* For({
            each: props.items,
            children: function* (item) {
              return view(function* () {
                return (
                  <li>
                    {yield* item.id}: {yield* item.text}
                  </li>
                );
              });
            }
          })
        }
      </ul>
    );
  });
});

const ProjList = $component(function* ProjList(
  props: Props<{ count: Source<number, StreamError, true>; rows: Path<StreamItem[]> }>
) {
  return view(function* () {
    return (
      <ul id="proj-list">
        {
          yield* Repeat({
            count: props.count,
            children: function* (i) {
              // A row exists only for an index the store already holds: its
              // reads are settled. The index is a source (D-055), read in the
              // holes that walk to the row (a setup does not read, D-042).
              return view(function* () {
                return (
                  <li>
                    {yield* props.rows[yield* i].id}: {yield* props.rows[yield* i].text}
                  </li>
                );
              });
            }
          })
        }
      </ul>
    );
  });
});

const Stream = $component(function* Stream() {
  // A memo over an async iterable: its latest value, pending until the first.
  const memoItems = yield* $memo(function* () {
    return yield* attempt(
      () => accumulate(),
      cause => new StreamError(cause)
    );
  });

  // A projection over the same stream: the body answers with the async
  // iterable that pushes each item into the draft. Its length is pending
  // until the first yield.
  const projItems = yield* $projection(function* (state: StreamItem[]) {
    return yield* attempt(
      () =>
        (async function* () {
          for await (const val of getData()) {
            state.push(val);
            yield;
          }
        })(),
      cause => new StreamError(cause)
    );
  }, [] as StreamItem[]);
  const count = projItems.length;
  // Stated: a row exists only for an index the store already holds (the
  // Repeat counts `length`), so a row's reads are settled.
  const rows = projItems as unknown as Path<StreamItem[]>;

  return view(function* () {
    return (
      <>
        <h1>Async Iterable Streaming</h1>
        <p>Both lists stream items from an async generator, one per second.</p>
        <div style={{ display: "flex", gap: "2em" }}>
          <div>
            <h2>createMemo</h2>
            <p>Accumulates an immutable array each yield.</p>
            {
              yield* Loading({
                fallback: function* () {
                  return <span class="loader">Loading memo...</span>;
                },
                children: function* () {
                  return <>{yield* MemoList({ items: memoItems })}</>;
                }
              })
            }
          </div>
          <div>
            <h2>createProjection</h2>
            <p>Pushes into a reactive store each yield.</p>
            {
              yield* Loading({
                fallback: function* () {
                  return <span class="loader">Loading projection...</span>;
                },
                children: function* () {
                  return <>{yield* ProjList({ count, rows })}</>;
                }
              })
            }
          </div>
        </div>
      </>
    );
  });
});

export default Stream;
