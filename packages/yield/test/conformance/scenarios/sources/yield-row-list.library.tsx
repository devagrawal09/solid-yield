import { $cleanup, $component, $event, For, view } from "solid-yield";
import { h } from "conformance";

interface Item {
  id: number;
  label: string;
}

export let setItems: (update: (list: Item[]) => Item[]) => unknown;

export const App = $component(function* App() {
  const [items, si] = yield* h.$signal<Item[]>("items", [
    { id: 1, label: "a" },
    { id: 2, label: "b" }
  ]);
  setItems = $event(function* (update: (list: Item[]) => Item[]) {
    yield* si(update);
  });
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: items,
            children: function* (c) {
              // a setup never reads (D-042): the row's trace label is the harness's read
              const label = h.peek<string>(c.label);
              h.run("setup " + label);
              const [open, setOpen] = yield* h.$signal("open " + label, true);
              yield* $cleanup(() => h.run("cleanup " + label));
              const toggle = $event(function* () {
                h.run("toggle " + label);
                yield* setOpen(!(yield* open));
              });
              return view(function* () {
                return (
                  <li class={"row r" + (yield* c.id)} onClick={yield* toggle}>
                    {yield* c.label}={(yield* open) ? "open" : "closed"}
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
