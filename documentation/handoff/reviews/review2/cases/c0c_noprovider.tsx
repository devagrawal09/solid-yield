import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render } from "@solidjs/web";
import { fetchTodos } from "./errors";

const ThemeCtx = createContext<string>();

function Counter() {
  const [count, setCount] = createSignal(0);
  setTimeout(() => console.log(count()), 100);
  return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}

function TodoList(props: { listId: string }) {
  const theme = useContext(ThemeCtx);
  const todos = createMemo(() => fetchTodos(props.listId));
  return (
    <ul class={theme}>
      <For each={todos()}>{todo => <li>{todo.title}</li>}</For>
    </ul>
  );
}

function Form() {
  const [msg, setMsg] = createSignal("");
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    await fetchTodos("x");
    setMsg("saved");
  }
  return <form onSubmit={submit}><button>go</button>{msg()}</form>;
}

function App() {
  return (
    <>
      <Counter />
      <Errored fallback={(e: any) => <p>{String(e)}</p>}>
        <Loading fallback="loading"><TodoList listId="1" /></Loading>
      </Errored>
      <Form />
    </>
  );
}
render(() => <App />, document.getElementById("root")!);
