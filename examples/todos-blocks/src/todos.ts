// If you came here to enumerate React-vs-Solid syntax differences, you've
// already misread this example. The thing that matters is what ~170 lines
// accomplishes — fetch + per-item optimistic writes + per-item errors +
// retry + bulk operations + loading + transitions, with the layering
// enforced by primitive composition rather than by convention. That, not
// the symbol diff, is what's distinctive.
//
// State architecture: three lifetime layers, each a derivation of the layer
// below, applied in a fixed order across the whole application.
//
//   3. Optimistic  (transition-scoped) ── `setTodos` writes inside `$event`
//                                         generators, auto-revert on settle.
//                                         Layered on top of (2).
//   2. Ephemeral   (UI-scoped)         ── the `Errors` side-channel below,
//                                         applied inside the projection fn
//                                         on top of (1). Survives optimistic
//                                         revert because it lives *under* the
//                                         optimistic overlay, not in it. Same
//                                         tier covers success toasts, drafts,
//                                         modal state, etc.
//   1. Persistent  (durable)           ── `api.getTodos()` inside the
//                                         projection fn. Server here; could
//                                         equally be localStorage / IndexedDB
//                                         / URL — the framework doesn't care.
//
// Consumers read the topmost layer (`todos`). The ordering isn't a choice —
// the primitive composition enforces it: the projection runs (1)→(2), and
// `createOptimisticStore` wraps that with (3). Splitting the layers into
// separate stores (a `createStore` projection + a `createProjection` overlay
// + an outer `createOptimisticStore`) is possible and gives each layer its
// own identity, but exposes intermediate views as accidental footguns; the
// single-primitive form is canonical.

import {
  $event,
  $optimisticStore,
  attempt,
  readStore,
  refresh,
  type EventCall
} from "solid-blocks";
import { api, type Todo as ServerTodo } from "./api";

/** The todo API failed: the color of every todo request's failure. */
export class ApiError extends Error {
  readonly kind = "api" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
const apiError = (cause: unknown) => new ApiError(cause);

export type TodoError = {
  type: "addTodo" | "removeTodo" | "toggleTodo";
  args: any[];
};

export interface Todo extends ServerTodo {
  pending?: boolean;
  error?: TodoError;
}

// Side-channel of action failures, keyed by todo id. Plain (non-reactive)
// JS map — read only inside the projection function, which re-runs on
// `refresh(todos)`. Mutations followed by `refresh(todos)` are what make
// errors visible; nothing else observes this object directly.
const Errors: Record<string, TodoError> = {};

function applyErrors(todos: Todo[], errors: Record<string, TodoError>) {
  for (const key in errors) {
    const error = errors[key];
    switch (error.type) {
      case "addTodo": {
        // Server doesn't have this todo (the add failed). Reinsert it locally
        // in id-sorted position with `error` set so it shows in the list.
        const newTodo: Todo = { ...error.args[0], error };
        const index = todos.findIndex(t => t.id > newTodo.id);
        if (index > -1) todos.splice(index, 0, newTodo);
        else todos.push(newTodo);
        break;
      }
      case "removeTodo":
      case "toggleTodo": {
        const todo = todos.find(t => t.id === error.args[0]);
        if (todo) todo.error = error;
        break;
      }
    }
  }
}

/**
 * The todos store and its actions, for a setup: `const todos = yield* createTodos()`.
 * The store is an optimistic projection of the server's list (pending until
 * the first fetch lands); every action is an `$event` whose writes revert
 * when it settles, after `refresh` has pulled the server's answer.
 */
export function* createTodos() {
  const [todos, setTodos] = yield* $optimisticStore(function* () {
    const todos: Todo[] = yield* attempt(() => api.getTodos(), apiError);
    applyErrors(todos, Errors);
    return todos;
  }, [] as Todo[]);

  const actions = {
    addTodo: $event(function* (todo: ServerTodo) {
      yield* setTodos(t => {
        const old = t.find(x => x.id === todo.id);
        if (old) old.pending = true;
        else t.push({ ...todo, pending: true });
      });
      try {
        yield* attempt(() => api.addTodo(todo), apiError);
        delete Errors[todo.id];
      } catch {
        Errors[todo.id] ||= { type: "addTodo", args: [todo] };
      }
      yield* refresh(todos);
    }),
    removeTodo: $event(function* (id: string) {
      yield* setTodos(t => t.filter(todo => todo.id !== id));
      try {
        yield* attempt(() => api.removeTodo(id), apiError);
        delete Errors[id];
      } catch {
        Errors[id] ||= { type: "removeTodo", args: [id] };
      }
      yield* refresh(todos);
    }),
    toggleTodo: $event(function* (id: string, completed: boolean) {
      yield* setTodos(t => {
        const todo = t.find(x => x.id === id);
        if (todo) {
          todo.completed = completed;
          todo.pending = true;
        }
      });
      try {
        yield* attempt(() => api.toggleTodo(id, completed), apiError);
        delete Errors[id];
      } catch {
        Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
      }
      yield* refresh(todos);
    }),
    toggleAll: $event(function* (completed: boolean) {
      const ids = yield* readStore(todos, t =>
        t.filter(x => x.completed !== completed).map(x => x.id)
      );
      const set = new Set(ids);
      yield* setTodos(t => {
        t.forEach(todo => {
          if (set.has(todo.id)) {
            todo.completed = completed;
            todo.pending = true;
          }
        });
      });
      try {
        yield* attempt(() => api.toggleAll(ids, completed), apiError);
        ids.forEach(id => delete Errors[id]);
      } catch {
        // Bulk failed — fan the error out to per-item entries so each
        // failed todo gets its own retry affordance via `retryTodo`.
        ids.forEach(id => {
          Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
        });
      }
      yield* refresh(todos);
    }),
    clearCompleted: $event(function* () {
      const ids = yield* readStore(todos, t => t.filter(x => x.completed).map(x => x.id));
      yield* setTodos(t => t.filter(todo => !todo.completed));
      try {
        yield* attempt(() => api.clearCompleted(ids), apiError);
        ids.forEach(id => delete Errors[id]);
      } catch {
        ids.forEach(id => {
          Errors[id] ||= { type: "removeTodo", args: [id] };
        });
      }
      yield* refresh(todos);
    })
  };

  // Re-runs the failed action recorded on the todo: an event, so the call it
  // makes is delegated to (and its colors are this event's).
  const retryTodo = $event(function* (todo: Todo) {
    if (!todo.error) return;
    const retry = actions[todo.error.type] as (
      ...args: unknown[]
    ) => EventCall<void, ApiError, boolean, true>;
    yield* retry(...todo.error.args);
  });

  return [todos, { ...actions, retryTodo }] as const;
}
