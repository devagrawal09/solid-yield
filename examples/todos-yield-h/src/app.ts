// TodoMVC from examples/todos with solid-yield, no-JSX flavor: views are
// built with `h` (no JSX transform, no build step needed for the views).
// Same data layer, markup and behavior as the original and the JSX twin.
//
// In `h` every hole is a source, a routine or a bare `function*`: the view
// generator itself never reads (a no-JSX view may only yield child views),
// so it runs once and each hole is its own computation. Components given to
// `h` (`h(TodoItem, { todo })`) are created when the output is materialized,
// where it is inserted — as a JSX tag would be.
import {
  component,
  $event,
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
import { h } from "solid-yield/h";
import { createTodos, type Todo } from "./todos";
import { hashFilter, type Filter } from "./filter";

/** What a generator helper returns once delegated to. */
type Returned<F> = F extends (...args: never[]) => Generator<unknown, infer R, unknown> ? R : never;

type Todos = Returned<typeof createTodos>;
/**
 * The todos store and the actions, for the components below `App`. Created
 * without a default: a component that reads it requires it (D-098), and
 * `App` provides it around its call. Its value is read like a prop (D-042):
 * `todos` is a path over the store, an action a source of the handler,
 * called in an event as `yield* (yield* addTodo)(todo)`.
 */
const TodosContext = createContext<{ todos: Todos[0] } & Todos[1], "TodosContext">(undefined, {
  name: "TodosContext"
});

/** The todos store (pending until the first fetch lands) and the actions. */
function* useTodos() {
  return yield* TodosContext;
}

type Input = InputEvent & { currentTarget: HTMLInputElement };
type Key = KeyboardEvent & { currentTarget: HTMLInputElement };

const Header = component(function* Header() {
  const { addTodo } = yield* useTodos();
  const submit = $event(function* (e: Key) {
    if (e.key !== "Enter") return;
    const input = e.currentTarget;
    const title = input.value.trim();
    if (!title) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // the event is gone once the call waits: clear the input first
    input.value = "";
    yield* (yield* addTodo)({ id, title, completed: false });
  });
  return view(function* () {
    return h(
      "header",
      { class: "header" },
      h("h1", "todos"),
      h("input", {
        class: "new-todo",
        placeholder: "What needs to be done?",
        autofocus: true,
        onKeyDown: submit
      })
    );
  });
});

const TodoItem = component(function* TodoItem(props: Props<{ todo: Todo }>) {
  const { toggleTodo, removeTodo, retryTodo } = yield* useTodos();
  const toggle = $event(function* (e: Input) {
    yield* (yield* toggleTodo)(yield* props.todo.id, e.currentTarget.checked);
  });
  const retry = $event(function* () {
    yield* (yield* retryTodo)(yield* props.todo);
  });
  const remove = $event(function* () {
    yield* (yield* removeTodo)(yield* props.todo.id);
  });
  const classes = yield* $memo(function* () {
    return [
      "todo",
      {
        completed: yield* props.todo.completed,
        pending: !!(yield* props.todo.pending),
        errored: !!(yield* props.todo.error)
      }
    ];
  });
  return view(function* () {
    return h(
      "li",
      { class: classes },
      h(
        "div",
        { class: "view" },
        h("input", {
          class: "toggle",
          type: "checkbox",
          checked: props.todo.completed,
          onInput: toggle
        }),
        h("label", props.todo.title),
        Show({
          when: props.todo.error,
          children: function* (error) {
            return view(function* () {
              return h("button", {
                class: "retry",
                title: function* () {
                  return `Retry ${yield* error.type}`;
                },
                onClick: retry
              });
            });
          }
        }),
        h("button", { class: "destroy", onClick: remove })
      )
    );
  });
});

const MainSection = component(function* MainSection(props: Props<{ filter: Filter }>) {
  const { todos, toggleAll } = yield* useTodos();
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
  const hasTodos = yield* $memo(function* () {
    return (yield* todos.length) > 0;
  });
  const toggle = $event(function* () {
    yield* (yield* toggleAll)(!(yield* allCompleted));
  });
  return view(function* () {
    return Show({
      when: hasTodos,
      children: h(
        "section",
        { class: "main" },
        h("input", {
          id: "toggle-all",
          class: "toggle-all",
          type: "checkbox",
          checked: allCompleted,
          onChange: toggle
        }),
        h("label", { for: "toggle-all" }, "Mark all as complete"),
        h(
          "ul",
          { class: "todo-list" },
          For({ each: filtered, children: todo => h(TodoItem, { todo }) })
        )
      )
    });
  });
});

const Footer = component(function* Footer(props: Props<{ filter: Filter }>) {
  const { todos, clearCompleted } = yield* useTodos();
  const remaining = yield* $memo(function* () {
    return yield* readStore(todos, t => t.filter(x => !x.completed).length);
  });
  const completed = yield* $memo(function* () {
    return (yield* todos.length) - (yield* remaining);
  });
  const hasTodos = yield* $memo(function* () {
    return (yield* todos.length) > 0;
  });
  const clear = $event(function* () {
    yield* (yield* clearCompleted)();
  });
  const link = (href: string, label: string, value: Filter) =>
    h(
      "li",
      h(
        "a",
        {
          href,
          class: function* () {
            return { selected: (yield* props.filter) === value };
          }
        },
        label
      )
    );
  return view(function* () {
    return Show({
      when: hasTodos,
      children: h(
        "footer",
        { class: "footer" },
        h(
          "span",
          { class: "todo-count" },
          h("strong", remaining),
          " ",
          function* () {
            return (yield* remaining) === 1 ? "item" : "items";
          },
          " left"
        ),
        h(
          "ul",
          { class: "filters" },
          link("#/", "All", "all"),
          link("#/active", "Active", "active"),
          link("#/completed", "Completed", "completed")
        ),
        Show({
          when: function* () {
            return (yield* completed) > 0;
          },
          children: h("button", { class: "clear-completed", onClick: clear }, "Clear completed")
        })
      )
    });
  });
});

export const App = component(function* App() {
  const filter = yield* hashFilter();
  const [todos, actions] = yield* createTodos();
  return view(function* () {
    return h(
      Errored,
      {
        fallback: (err, reset) =>
          h(
            "div",
            { class: "app-error" },
            h("p", "Something went wrong: ", String(err())),
            h("button", { onClick: reset }, "Reset")
          )
      },
      h(
        TodosContext.provide,
        { value: { todos, ...actions } },
        h(
          "section",
          { class: "todoapp" },
          h(Header, {}),
          h(
            Loading,
            { fallback: h("p", { class: "loading" }, "Loading…") },
            h(MainSection, { filter }),
            h(Footer, { filter })
          )
        )
      )
    );
  });
});
