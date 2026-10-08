import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render, Portal } from "@solidjs/web";
import { fetchTodos, FetchError } from "./errors";

function Page() { const [c] = createSignal(0); createEffect(() => c(), v => { throw new FetchError("x"); }); return <p>{c()}</p>; }
function App() { return <Page />; }
render(() => <App />, document.getElementById("root")!);
