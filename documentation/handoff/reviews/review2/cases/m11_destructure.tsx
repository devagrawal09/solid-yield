import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render, Portal } from "@solidjs/web";
import { fetchTodos, FetchError } from "./errors";

function Page({ listId }: { listId: string }) {
  const todos = createMemo(() => fetchTodos(listId));
  return <p>{todos().length}</p>;
}
function Wrapper() { return <Page listId="1" />; }
function App() {
  return <Errored fallback={(e: any) => <p>{String(e)}</p>}><Loading fallback="l"><Page /></Loading></Errored>;
}
render(() => <App />, document.getElementById("root")!);
