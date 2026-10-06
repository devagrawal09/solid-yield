// TodoMVC from examples/todos with solid-yield (JSX flavor). The data
// layer (`todos.ts`: an optimistic store over a projection, actions, the
// error side-channel) and `filter.ts` are generator helpers the App's setup
// delegates to; `api.ts` is the original's.
//
// What the library's rules change here:
// - every read and write is a `yield*`: no plain Solid state in routine code;
// - components are `component`s: setups read the context (`yield* TodosContext`)
//   and create handlers (`$event`); views read in JSX holes;
// - the todos store is an `$optimisticStore` whose body fetches (pending
//   until the first fetch lands); structural reads go through `readStore`;
// - a view that reads a pending store is pending, so the loading boundary
//   receives the two sections in its lazy view: `{yield* MainSection(…)}{yield* Footer(…)}`.
import {
  component,
  $event,
  $signal,
  $memo,
  createContext,
  Errored,
  For,
  Loading,
  readStore,
  Show,
  type Props,
  view
} from "solid-yield";
import { createTodos, type Todo } from "./todos";
import { hashFilter, type Filter } from "./filter";

/** What a generator helper returns once delegated to. */
type Returned<F> = F extends (...args: never[]) => Generator<unknown, infer R, unknown> ? R : never;

const TodosContext = createContext<Returned<typeof createTodos>>();

/** The todos store (pending until the first fetch lands) and the actions. */
function* useTodos() {
  return yield* TodosContext;
}

type Input = InputEvent & { currentTarget: HTMLInputElement };
type Key = KeyboardEvent & { currentTarget: HTMLInputElement };

const Header = component(function* Header() {
  const [s, set] = yield* $signal(0);
  const ss = yield* $memo(function* () {
    return yield* s;
  });
  const [, { addTodo }] = yield* useTodos();
  const submit = $event(function* (e: Key) {
    if (e.key !== "Enter") return;
    const input = e.currentTarget;
    const title = input.value.trim();
    if (!title) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // the event is gone once the call waits: clear the input first
    input.value = "";
    yield* addTodo({ id, title, completed: false });
  });
  return view(function* () {
    return (
      <header class="header">
        <h1>todos</h1>
        <input class="new-todo" placeholder="What needs to be done?" autofocus onKeyDown={submit} />
      </header>
    );
  });
});

const TodoItem = component(function* TodoItem(props: Props<{ todo: Todo }>) {
  const [, { toggleTodo, removeTodo, retryTodo }] = yield* useTodos();
  const toggle = $event(function* (e: Input) {
    yield* toggleTodo(yield* props.todo.id, e.currentTarget.checked);
  });
  const retry = $event(function* () {
    yield* retryTodo(yield* props.todo);
  });
  const remove = $event(function* () {
    yield* removeTodo(yield* props.todo.id);
  });
  return view(function* () {
    return (
      <li
        class={[
          "todo",
          {
            completed: yield* props.todo.completed,
            pending: !!(yield* props.todo.pending),
            errored: !!(yield* props.todo.error)
          }
        ]}
      >
        <div class="view">
          <input
            class="toggle"
            type="checkbox"
            checked={yield* props.todo.completed}
            onInput={toggle}
          />
          <label>{yield* props.todo.title}</label>
          {
            yield* Show({
              when: props.todo.error,
              children: function* (error) {
                return view(function* () {
                  return (
                    <button class="retry" title={`Retry ${yield* error.type}`} onClick={retry} />
                  );
                });
              }
            })
          }
          <button class="destroy" onClick={remove} />
        </div>
      </li>
    );
  });
});

const MainSection = component(function* MainSection(props: Props<{ filter: Filter }>) {
  const [todos, { toggleAll }] = yield* useTodos();
  const filtered = yield* $memo(function* () {
    const f = yield* props.filter;
    return yield* readStore(todos, t =>
      f === "active"
        ? t.filter(x => !x.completed)
        : f === "completed"
          ? t.filter(x => x.completed)
          : t
    );
  });
  const allCompleted = yield* $memo(function* () {
    return yield* readStore(todos, t => t.length > 0 && t.every(x => x.completed));
  });
  const toggle = $event(function* () {
    yield* toggleAll(!(yield* allCompleted));
  });
  return view(function* () {
    return (
      <>
        {
          yield* Show({
            when: function* () {
              return (yield* todos.length) > 0;
            },
            children: function* () {
              return (
                <section class="main">
                  <input
                    id="toggle-all"
                    class="toggle-all"
                    type="checkbox"
                    checked={yield* allCompleted}
                    onChange={toggle}
                  />
                  <label for="toggle-all">Mark all as complete</label>
                  <ul class="todo-list">
                    {
                      yield* For({
                        each: filtered,
                        children: function* (todo) {
                          return view(function* () {
                            return <>{yield* TodoItem({ todo: todo })}</>;
                          });
                        }
                      })
                    }
                  </ul>
                </section>
              );
            }
          })
        }
      </>
    );
  });
});

const Footer = component(function* Footer(props: Props<{ filter: Filter }>) {
  const [todos, { clearCompleted }] = yield* useTodos();
  const remaining = yield* $memo(function* () {
    return yield* readStore(todos, t => t.filter(x => !x.completed).length);
  });
  const completed = yield* $memo(function* () {
    return (yield* todos.length) - (yield* remaining);
  });
  const clear = $event(function* () {
    yield* clearCompleted();
  });
  return view(function* () {
    return (
      <>
        {
          yield* Show({
            when: function* () {
              return (yield* todos.length) > 0;
            },
            children: function* () {
              return (
                <footer class="footer">
                  <span class="todo-count">
                    <strong>{yield* remaining}</strong>{" "}
                    {(yield* remaining) === 1 ? "item" : "items"} left
                  </span>
                  <ul class="filters">
                    <li>
                      <a href="#/" class={{ selected: (yield* props.filter) === "all" }}>
                        All
                      </a>
                    </li>
                    <li>
                      <a href="#/active" class={{ selected: (yield* props.filter) === "active" }}>
                        Active
                      </a>
                    </li>
                    <li>
                      <a
                        href="#/completed"
                        class={{ selected: (yield* props.filter) === "completed" }}
                      >
                        Completed
                      </a>
                    </li>
                  </ul>
                  {
                    yield* Show({
                      when: function* () {
                        return (yield* completed) > 0;
                      },
                      children: function* () {
                        return (
                          <button class="clear-completed" onClick={clear}>
                            Clear completed
                          </button>
                        );
                      }
                    })
                  }
                </footer>
              );
            }
          })
        }
      </>
    );
  });
});

/** The app's section: its list and footer read the store, so it waits for it and fails with it. */
const TodoApp = component(function* TodoApp(props: Props<{ filter: Filter }>) {
  return view(function* () {
    return (
      <section class="todoapp">
        {yield* Header()}
        {
          yield* Loading({
            fallback: <p class="loading">Loading…</p>,
            children: function* () {
              return (
                <>{[MainSection({ filter: props.filter }), Footer({ filter: props.filter })]}</>
              );
            }
          })
        }
      </section>
    );
  });
});

export const App = component(function* App() {
  const filter = yield* hashFilter();
  const todos = yield* createTodos();
  return view(function* () {
    return (
      <TodosContext value={todos}>
        {Errored({
          fallback: (err, reset) => (
            <div class="app-error">
              <p>Something went wrong: {String(err())}</p>
              <button onClick={reset}>Reset</button>
            </div>
          ),
          children: function* () {
            return <>{yield* TodoApp({ filter })}</>;
          }
        })}
      </TodosContext>
    );
  });
});
