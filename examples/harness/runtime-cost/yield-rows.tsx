// The same table with solid-yield, uncompiled: rows are row routines that
// read their fields in holes. The dialect as it stands: call form (D-062),
// writes delegated (D-021), views wrapped.
import { $component, $event, $store, For, render, view } from "solid-yield";
import { flush } from "solid-js";

type Row = { id: number; label: string };

export function mount(root: HTMLElement) {
  let setRows!: (fn: (s: { items: Row[] }) => void) => Promise<unknown>;
  const App = $component(function* App() {
    const [rows, set] = yield* $store<{ items: Row[] }>({ items: [] });
    setRows = $event(function* (fn: (s: { items: Row[] }) => void) {
      yield* set(s => void fn(s));
    });
    return view(function* () {
      return (
        <table>
          <tbody>
            {
              yield* For({
                each: rows.items,
                children: function* (row) {
                  return view(function* () {
                    return (
                      <tr>
                        <td>{yield* row.id}</td>
                        <td>{yield* row.label}</td>
                      </tr>
                    );
                  });
                }
              })
            }
          </tbody>
        </table>
      );
    });
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
    /** What the workload left in the DOM, compared across flavors. */
    check: () =>
      `${root.querySelectorAll("tr").length} tr, ${(root.textContent!.match(/!!!/g) || []).length} updated`,
    dispose
  };
}
