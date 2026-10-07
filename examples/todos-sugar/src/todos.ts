"use yield";
import { Failure } from "solid-yield";
import { $event, $optimisticStore, attempt, readStore, refresh, type EventCall } from "solid-yield";
import { api, type Todo as ServerTodo } from "./api";
export class ApiError extends Failure("api") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
const apiError = (cause: unknown) => new ApiError(cause);
const settled = (request: Promise<unknown>) => request.then(() => true as const);
const absorb = () => {};
export type TodoError = {
  type: "addTodo" | "removeTodo" | "toggleTodo";
  args: any[];
};
export interface Todo extends ServerTodo {
  pending?: boolean;
  error?: TodoError;
}
const Errors: Record<string, TodoError> = {};
function applyErrors(todos: Todo[], errors: Record<string, TodoError>) {
  for (const key in errors) {
    const error = errors[key];
    switch (error.type) {
      case "addTodo": {
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
export function createTodos() {
  const [todos, setTodos] = $optimisticStore(function () {
    const todos: Todo[] = attempt(() => api.getTodos(), apiError);
    applyErrors(todos, Errors);
    return todos;
  }, [] as Todo[]);
  const actions = {
    addTodo: $event(function (todo: ServerTodo) {
      setTodos(t => {
        const old = t.find(x => x.id === todo.id);
        if (old) old.pending = true;
        else t.push({ ...todo, pending: true });
      });
      if (attempt(() => settled(api.addTodo(todo)), absorb)) delete Errors[todo.id];
      else Errors[todo.id] ||= { type: "addTodo", args: [todo] };
      refresh(todos);
    }),
    removeTodo: $event(function (id: string) {
      setTodos(t => t.filter(todo => todo.id !== id));
      if (attempt(() => settled(api.removeTodo(id)), absorb)) delete Errors[id];
      else Errors[id] ||= { type: "removeTodo", args: [id] };
      refresh(todos);
    }),
    toggleTodo: $event(function (id: string, completed: boolean) {
      setTodos(t => {
        const todo = t.find(x => x.id === id);
        if (todo) {
          todo.completed = completed;
          todo.pending = true;
        }
      });
      if (attempt(() => settled(api.toggleTodo(id, completed)), absorb)) delete Errors[id];
      else Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
      refresh(todos);
    }),
    toggleAll: $event(function (completed: boolean) {
      const ids = readStore(todos, t => t.filter(x => x.completed !== completed).map(x => x.id));
      const set = new Set(ids);
      setTodos(t => {
        t.forEach(todo => {
          if (set.has(todo.id)) {
            todo.completed = completed;
            todo.pending = true;
          }
        });
      });
      if (attempt(() => settled(api.toggleAll(ids, completed)), absorb))
        ids.forEach(id => delete Errors[id]);
      else
        ids.forEach(id => {
          Errors[id] ||= { type: "toggleTodo", args: [id, completed] };
        });
      refresh(todos);
    }),
    clearCompleted: $event(function () {
      const ids = readStore(todos, t => t.filter(x => x.completed).map(x => x.id));
      setTodos(t => t.filter(todo => !todo.completed));
      if (attempt(() => settled(api.clearCompleted(ids)), absorb))
        ids.forEach(id => delete Errors[id]);
      else
        ids.forEach(id => {
          Errors[id] ||= { type: "removeTodo", args: [id] };
        });
      refresh(todos);
    })
  };
  const retryTodo = $event(function (todo: Todo) {
    if (!todo.error) return;
    const retry = actions[todo.error.type] as (
      ...args: unknown[]
    ) => EventCall<void, never, boolean, true>;
    retry(...todo.error.args);
  });
  return [todos, { ...actions, retryTodo }] as const;
}
