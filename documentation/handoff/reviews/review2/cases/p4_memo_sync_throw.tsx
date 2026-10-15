import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render, Portal } from "@solidjs/web";
import { fetchTodos, FetchError } from "./errors";

function Page() { const m = createMemo(() => { throw new FetchError("x"); }); return <p>{m()}</p>; }
function App() { return <Page />; }
render(() => <App />, document.getElementById("root")!);
