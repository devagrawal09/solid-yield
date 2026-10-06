// The same todo list with solid-yield, uncompiled (the runtime
// interpreter; only the JSX transform's yield*-in-JSX rule), in the dialect
// as it stands: call form (D-062), writes delegated (D-021), views wrapped.
import { component, $event, $store, For, render, view } from "solid-yield";
import { flush } from "solid-js";

type Todo = { id: number; title: string; done: boolean };

export function mount(root: HTMLElement) {
  let add!: (title: string) => Promise<unknown>;
  let toggle!: (id: number) => Promise<unknown>;
  const App = component(function* App() {
    const [todos, setTodos] = yield* $store<Todo[]>([]);
    let next = 0;
    add = $event(function* (title: string) {
      yield* setTodos(t => void t.push({ id: next++, title, done: false }));
    });
    const flip = $event(function* (id: number) {
      yield* setTodos(t => {
        const todo = t.find(x => x.id === id)!;
        todo.done = !todo.done;
      });
    });
    toggle = flip;
    return view(function* () {
      return (
        <ul>
          {
            yield* For({
              each: todos,
              children: function* (todo) {
                const onInput = $event(function* () {
                  yield* flip(yield* todo.id);
                });
                return view(function* () {
                  return (
                    <li class={(yield* todo.done) ? "done" : ""}>
                      <input type="checkbox" checked={yield* todo.done} onInput={onInput} />
                      <label>{yield* todo.title}</label>
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
  const dispose = render(App, root);
  flush();
  let id = 0;
  return {
    op() {
      add(`todo ${id}`);
      flush();
      toggle(id++);
      flush();
    },
    /** What the workload left in the DOM, compared across flavors. */
    check: () =>
      `${root.querySelectorAll("li").length} li, ${root.querySelectorAll("li.done").length} done`,
    dispose
  };
}
