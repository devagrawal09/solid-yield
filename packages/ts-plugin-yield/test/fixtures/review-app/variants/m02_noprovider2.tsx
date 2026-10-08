import { createSignal, createMemo, createContext, useContext, Loading, Errored, For } from "solid-js";
import { fetchItems } from "./api";

const ThemeCtx = createContext<string>();
const UserCtx = createContext<string>();

function Counter() {
  const [count, setCount] = createSignal(0);
  const twice = createMemo(() => count() * 2);
  return <button onClick={() => setCount(count() + 1)}>{count()} / {twice()}</button>;
}

function List() {
  const theme = useContext(ThemeCtx);
  const user = useContext(UserCtx);
  const items = createMemo(() => fetchItems());
  return (
    <ul class={theme + user}>
      <For each={items()}>{item => <li>{item.name}</li>}</For>
    </ul>
  );
}

export function App() {
  return (
    <ThemeCtx value="dark">
      <Counter />
      <Errored fallback={err => <p>failed: {String(err)}</p>}>
        <Loading fallback="loading…">
          <List />
        </Loading>
      </Errored>
    </ThemeCtx>
  );
}
