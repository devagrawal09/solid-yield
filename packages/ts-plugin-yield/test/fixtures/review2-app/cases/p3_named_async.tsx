import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render, Portal } from "@solidjs/web";
import { fetchTodos, FetchError } from "./errors";

async function save() { await fetchTodos("bad"); }
function Page() { return <button onClick={save}>go</button>; }
function App() { return <Page />; }
render(() => <App />, document.getElementById("root")!);
