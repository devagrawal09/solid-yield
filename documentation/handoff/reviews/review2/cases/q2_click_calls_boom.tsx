import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render, Portal } from "@solidjs/web";
import { fetchTodos, FetchError } from "./errors";

function boom(): void { throw new FetchError("x"); }
function Page() { return <button onClick={() => { boom(); }}>go</button>; }
function App() { return <Page />; }
render(() => <App />, document.getElementById("root")!);
