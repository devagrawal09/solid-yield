import { For, Show } from "solid-js";

export function Pager(props: { count: number; onSetPage: (page: number) => void }) {
  return (
    <>
      <Show when={props.count > 1}>
        <ul>
          <For each={[...Array(props.count).keys()]}>
            {v => (
              <li
                onClick={e => {
                  e.preventDefault();
                  props.onSetPage(v);
                }}
              >
                {v + 1}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </>
  );
}
