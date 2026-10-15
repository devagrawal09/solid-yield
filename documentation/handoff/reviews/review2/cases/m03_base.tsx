import { createContext, createEffect, createMemo, createSignal, useContext, Loading, Errored, For } from "solid-js";
import { render, Portal } from "@solidjs/web";
import { fetchTodos, FetchError } from "./errors";

class Base extends Error {}
class NotFound extends Base {}
async function load(): Promise<number> { throw new NotFound("x"); }
function Page() {
  const n = createMemo(async () => { try { return await load(); } catch (e) { if (e instanceof Base) return -1; throw e; } });
  return <p>{n()}</p>;
}
function App() {
  return <Errored fallback={(e: any) => <p>{String(e)}</p>}><Loading fallback="l"><Page /></Loading></Errored>;
}
render(() => <App />, document.getElementById("root")!);
