import { createMemo, createSignal, createStore, For, isPending, Loading, Repeat } from "solid-js";
import type { JSX } from "@solidjs/web";

interface Entry {
  id: number;
  text: string;
}

async function* arrivals(): AsyncIterable<Entry> {
  for (const text of ["one", "two", "three"]) {
    await new Promise(resolve => setTimeout(resolve, 100));
    yield { id: text.length, text };
  }
}

async function fetchBoard(round: number): Promise<{ title: string; entries: Entry[] }> {
  await new Promise(resolve => setTimeout(resolve, 10));
  return { title: `round ${round}`, entries: [{ id: round, text: `entry ${round}` }] };
}

// F-S50: a component generic in its value type.
function Labeled<T extends string | number>(props: { value: T; children: JSX.Element }) {
  return (
    <p class="labeled">
      <b>{props.value}</b> {props.children}
    </p>
  );
}

export function Streams() {
  const [round, setRound] = createSignal(1);
  // F-S53: a derived store is a projection; isPending takes its path.
  const [board] = createStore(
    async draft => {
      const data = await fetchBoard(round());
      draft.title = data.title;
      draft.entries = data.entries;
    },
    { title: "", entries: [] as Entry[] }
  );
  // F-S53: an async iterable memo is its latest value.
  const streamed = createMemo<Entry[]>(async function* () {
    let seen: Entry[] = [];
    for await (const entry of arrivals()) yield (seen = [...seen, entry]);
  });
  const [names] = createStore(["ada", "grace"]);
  return (
    <section class={{ streams: true, busy: isPending(() => board.entries) }}>
      <Loading fallback={<p class="loading">board</p>}>
        <h3>{board.title}</h3>
        <For each={board.entries}>{entry => <Labeled value={entry.id}>{entry.text}</Labeled>}</For>
      </Loading>
      <button class="next-round" onClick={() => setRound(r => r + 1)}>
        next round
      </button>
      <Loading fallback={<p class="loading">stream</p>}>
        <ul class="streamed">
          <For each={streamed()}>{entry => <li>{entry.text}</li>}</For>
        </ul>
      </Loading>
      {/* F-S53: Repeat's index is a number to Solid, a source to the library. */}
      <ol class="names">
        <Repeat count={names.length}>
          {i => (
            <li>
              {i}: {names[i]}
            </li>
          )}
        </Repeat>
      </ol>
    </section>
  );
}
