import {
  createMemo,
  createProjection,
  createSignal,
  createStore,
  For,
  isPending,
  Loading,
  Repeat
} from "solid-js";

interface Item {
  id: number;
  text: string;
}

async function* items(): AsyncIterable<Item> {
  for (const text of ["a", "b", "c"]) {
    await new Promise(resolve => setTimeout(resolve, 100));
    yield { id: text.charCodeAt(0), text };
  }
}

async function load(version: number): Promise<{ title: string; items: Item[] }> {
  await new Promise(resolve => setTimeout(resolve, 50));
  return { title: `v${version}`, items: [{ id: 1, text: "x" }] };
}

export default function Feed() {
  const [version, setVersion] = createSignal(0);
  // F-S53: a derived store is a projection; isPending takes its path.
  const [feed] = createStore(
    async draft => {
      const data = await load(version());
      draft.title = data.title;
      draft.items = data.items;
    },
    { title: "", items: [] as Item[] },
    { seedLoadingValue: true }
  );
  // F-S53: async iterable producers; a projection's draft; Repeat's index as a key.
  const all = createMemo<Item[]>(async function* () {
    let seen: Item[] = [];
    for await (const item of items()) yield (seen = [...seen, item]);
  });
  const rows = createProjection<Item[]>(async function* (state) {
    for await (const item of items()) {
      state.push(item);
      yield;
    }
  }, []);
  return (
    <section class={{ busy: isPending(() => feed.items) }}>
      <h2>{feed.title}</h2>
      <button onClick={() => setVersion(v => v + 1)}>refetch</button>
      <Loading fallback="…">
        <ul>
          <For each={all()}>{item => <li>{item.text}</li>}</For>
        </ul>
        <ol>
          <Repeat count={rows.length}>
            {i => (
              <li>
                {i}: {rows[i].text}
              </li>
            )}
          </Repeat>
        </ol>
      </Loading>
    </section>
  );
}
