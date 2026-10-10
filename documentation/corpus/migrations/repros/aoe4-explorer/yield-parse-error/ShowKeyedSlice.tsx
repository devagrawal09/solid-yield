import { createMemo, createSignal, For, Show } from "solid-js";
async function load(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `p${i}`, diff: ["a", "b"] }));
}
export function S9(props: { n: number }) {
  const history = createMemo(() => load(props.n));
  const [all, setAll] = createSignal(false);
  return (
    <Show when={!!history().length && history()} keyed>
      {(list) => (
        <div>
          <For each={list.slice(0, all() ? undefined : 2)}>
            {(h) => {
              const [expanded, setExpanded] = createSignal(false);
              return (
                <div>
                  <For each={h.diff.filter((_, i) => i < 6 || expanded())}>{(d) => <p>{d}</p>}</For>
                  <button onClick={() => setExpanded(true)}>more</button>
                </div>
              );
            }}
          </For>
          <button onClick={() => setAll(true)}>all</button>
        </div>
      )}
    </Show>
  );
}
