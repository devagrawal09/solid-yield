// Handwritten Solid: a 1,000-row table (store, For), js-framework-benchmark
// style create and update-every-10th.
import { createStore, flush, For } from "solid-js";
import { render } from "@solidjs/web";

type Row = { id: number; label: string };

export function mount(root: HTMLElement) {
  let setRows!: (fn: (s: { items: Row[] }) => void) => void;
  function App() {
    const [rows, set] = createStore<{ items: Row[] }>({ items: [] });
    setRows = set;
    return (
      <table>
        <tbody>
          <For each={rows.items}>
            {row => (
              <tr>
                <td>{row.id}</td>
                <td>{row.label}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    );
  }
  const dispose = render(() => <App />, root);
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
    /** What the workload left in the DOM, compared across flavors. */
    check: () =>
      `${root.querySelectorAll("tr").length} tr, ${(root.textContent!.match(/!!!/g) || []).length} updated`,
    dispose
  };
}
