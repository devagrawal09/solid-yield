// Handwritten Solid: a todo list (store, For, a row per todo).
import { createStore, flush, For } from "solid-js";
import { render } from "@solidjs/web";

type Todo = { id: number; title: string; done: boolean };

export function mount(root: HTMLElement) {
  let add!: (title: string) => void;
  let toggle!: (id: number) => void;
  function App() {
    const [todos, setTodos] = createStore<Todo[]>([]);
    let next = 0;
    add = title => setTodos(t => void t.push({ id: next++, title, done: false }));
    toggle = id =>
      setTodos(t => {
        const todo = t.find(x => x.id === id)!;
        todo.done = !todo.done;
      });
    return (
      <ul>
        <For each={todos}>
          {todo => (
            <li class={todo.done ? "done" : ""}>
              <input type="checkbox" checked={todo.done} onInput={() => toggle(todo.id)} />
              <label>{todo.title}</label>
            </li>
          )}
        </For>
      </ul>
    );
  }
  const dispose = render(() => <App />, root);
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
