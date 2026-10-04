// The same table with @solidjs/blocks, uncompiled: rows are row blocks that
// read their fields in holes.
import { $component, $event, $store, For, render } from "@solidjs/blocks";
import { flush } from "solid-js";

type Row = { id: number; label: string };

export function mount(root: HTMLElement) {
  let setRows!: (fn: (s: { items: Row[] }) => void) => void;
  const App = $component(function* App() {
    const [rows, set] = yield* $store<{ items: Row[] }>({ items: [] });
    setRows = $event(function* (fn: (s: { items: Row[] }) => void) {
      set(s => void fn(s));
    });
    return function* () {
      return (
        <table>
          <tbody>
            <For each={yield* rows.items}>
              {function* (row) {
                return function* () {
                  return (
                    <tr>
                      <td>{yield* row.id}</td>
                      <td>{yield* row.label}</td>
                    </tr>
                  );
                };
              }}
            </For>
          </tbody>
        </table>
      );
    };
  });
  const dispose = render(App, root);
  flush();
  let id = 0;
  return {
    create() {
      const items: Row[] = [];
      for (let i = 0; i < 1000; i++) items.push({ id: ++id, label: `row ${id}` });
      setRows(s => void (s.items = items));
      flush();
    },
    clear() {
      setRows(s => void (s.items = []));
      flush();
    },
    update() {
      setRows(s => {
        for (let i = 0; i < s.items.length; i += 10) s.items[i].label += " !!!";
      });
      flush();
    },
    dispose
  };
}
