// The same todo list with solid-blocks, uncompiled (the runtime
// interpreter; only the JSX transform's yield*-in-JSX rule).
import { $component, $event, $store, For, render } from "solid-blocks";
import { flush } from "solid-js";

type Todo = { id: number; title: string; done: boolean };

export function mount(root: HTMLElement) {
  let add!: (title: string) => void;
  let toggle!: (id: number) => void;
  const App = $component(function* App() {
    const [todos, setTodos] = yield* $store<Todo[]>([]);
    let next = 0;
    add = $event(function* (title: string) {
      setTodos(t => void t.push({ id: next++, title, done: false }));
    });
    toggle = $event(function* (id: number) {
      setTodos(t => {
        const todo = t.find(x => x.id === id)!;
        todo.done = !todo.done;
      });
    });
    return function* () {
      return (
        <ul>
          <For each={yield* todos}>
            {function* (todo) {
              const onInput = $event(function* () {
                toggle(yield* todo.id);
              });
              return function* () {
                return (
                  <li class={(yield* todo.done) ? "done" : ""}>
                    <input type="checkbox" checked={yield* todo.done} onInput={onInput} />
                    <label>{yield* todo.title}</label>
                  </li>
                );
              };
            }}
          </For>
        </ul>
      );
    };
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
    dispose
  };
}
