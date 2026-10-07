"use yield";
import {
  $event,
  $signal,
  $memo,
  createContext,
  Errored,
  For,
  Loading,
  readStore,
  Show,
  type Props
} from "solid-yield";
import { createTodos, type Todo } from "./todos";
import { hashFilter, type Filter } from "./filter";
type Returned<F> = F extends (...args: never[]) => Generator<unknown, infer R, unknown> ? R : never;
type Todos = Returned<typeof createTodos>;
const TodosContext = createContext<
  {
    todos: Todos[0];
  } & Todos[1],
  "TodosContext"
>(undefined, {
  name: "TodosContext"
});
function useTodos() {
  return TodosContext();
}
type Input = InputEvent & {
  currentTarget: HTMLInputElement;
};
type Key = KeyboardEvent & {
  currentTarget: HTMLInputElement;
};
const Header = function Header() {
  const [s, set] = $signal(0);
  const ss = $memo(function () {
    return s();
  });
  const { addTodo } = useTodos();
  const submit = $event(function (e: Key) {
    if (e.key !== "Enter") return;
    const input = e.currentTarget;
    const title = input.value.trim();
    if (!title) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    input.value = "";
    addTodo({ id, title, completed: false });
  });
  return (
    <header class="header">
      <h1>todos</h1>
      <input class="new-todo" placeholder="What needs to be done?" autofocus onKeyDown={submit} />
    </header>
  );
};
const TodoItem = function TodoItem(
  props: Props<{
    todo: Todo;
  }>
) {
  const { toggleTodo, removeTodo, retryTodo } = useTodos();
  const toggle = $event(function (e: Input) {
    toggleTodo(props.todo.id, e.currentTarget.checked);
  });
  const retry = $event(function () {
    retryTodo(props.todo);
  });
  const remove = $event(function () {
    removeTodo(props.todo.id);
  });
  return (
    <li
      class={[
        "todo",
        {
          completed: props.todo.completed,
          pending: !!props.todo.pending,
          errored: !!props.todo.error
        }
      ]}
    >
      <div class="view">
        <input class="toggle" type="checkbox" checked={props.todo.completed} onInput={toggle} />
        <label>{props.todo.title}</label>
        {Show({
          when: props.todo.error,
          children: function (error) {
            return <button class="retry" title={`Retry ${error.type}`} onClick={retry} />;
          }
        })}
        <button class="destroy" onClick={remove} />
      </div>
    </li>
  );
};
const MainSection = function MainSection(
  props: Props<{
    filter: Filter;
  }>
) {
  const { todos, toggleAll } = useTodos();
  const filtered = $memo(function () {
    const f = props.filter;
    return readStore(todos, t =>
      f === "active"
        ? t.filter(x => !x.completed)
        : f === "completed"
          ? t.filter(x => x.completed)
          : t
    );
  });
  const allCompleted = $memo(function () {
    return readStore(todos, t => t.length > 0 && t.every(x => x.completed));
  });
  const toggle = $event(function () {
    toggleAll(!allCompleted());
  });
  return (
    <>
      {Show({
        when: function () {
          return todos.length > 0;
        },
        children: function () {
          return (
            <section class="main">
              <input
                id="toggle-all"
                class="toggle-all"
                type="checkbox"
                checked={allCompleted()}
                onChange={toggle}
              />
              <label for="toggle-all">Mark all as complete</label>
              <ul class="todo-list">
                {For({
                  each: filtered,
                  children: function (todo) {
                    return <>{TodoItem({ todo: todo })}</>;
                  }
                })}
              </ul>
            </section>
          );
        }
      })}
    </>
  );
};
const Footer = function Footer(
  props: Props<{
    filter: Filter;
  }>
) {
  const { todos, clearCompleted } = useTodos();
  const remaining = $memo(function () {
    return readStore(todos, t => t.filter(x => !x.completed).length);
  });
  const completed = $memo(function () {
    return todos.length - remaining();
  });
  const clear = $event(function () {
    clearCompleted();
  });
  return (
    <>
      {Show({
        when: function () {
          return todos.length > 0;
        },
        children: function () {
          return (
            <footer class="footer">
              <span class="todo-count">
                <strong>{remaining()}</strong> {remaining() === 1 ? "item" : "items"} left
              </span>
              <ul class="filters">
                <li>
                  <a href="#/" class={{ selected: props.filter === "all" }}>
                    All
                  </a>
                </li>
                <li>
                  <a href="#/active" class={{ selected: props.filter === "active" }}>
                    Active
                  </a>
                </li>
                <li>
                  <a href="#/completed" class={{ selected: props.filter === "completed" }}>
                    Completed
                  </a>
                </li>
              </ul>
              {Show({
                when: function () {
                  return completed() > 0;
                },
                children: function () {
                  return (
                    <button class="clear-completed" onClick={clear}>
                      Clear completed
                    </button>
                  );
                }
              })}
            </footer>
          );
        }
      })}
    </>
  );
};
const TodoApp = function TodoApp(
  props: Props<{
    filter: Filter;
  }>
) {
  return (
    <section class="todoapp">
      {Header()}
      {Loading({
        fallback: function () {
          return <p class="loading">Loading…</p>;
        },
        children: function () {
          return (
            <>
              {MainSection({ filter: props.filter })}
              {Footer({ filter: props.filter })}
            </>
          );
        }
      })}
    </section>
  );
};
export const App = function App() {
  const filter = hashFilter();
  const [todos, actions] = createTodos();
  return (
    <>
      {TodosContext.provide({
        value: { todos, ...actions },
        children: function () {
          return (
            <>
              {Errored({
                fallback: (err, reset) => (
                  <div class="app-error">
                    <p>Something went wrong: {String(err())}</p>
                    <button onClick={reset}>Reset</button>
                  </div>
                ),
                children: function () {
                  return <>{TodoApp({ filter })}</>;
                }
              })}
            </>
          );
        }
      })}
    </>
  );
};
