import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render, Portal } from "@solidjs/web";
import { fetchTodos, FetchError } from "./errors";

function boom(): void { throw new FetchError("x"); }
function Page() { const [c] = createSignal(0); setTimeout(() => { console.log(c()); boom(); }, 10); return <p>{c()}</p>; }
function App() { return <Page />; }
render(() => <App />, document.getElementById("root")!);
