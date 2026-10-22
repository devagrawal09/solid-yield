import { createSignal } from "solid-js";
interface Api { get(id: string): Promise<string>; set(id: string, v: string): void; add(v: string): void; delete(id: string): Promise<void>; has(id: string): boolean; from(v: string): string }
declare const api: Api;
export function App() {
  const [n, setN] = createSignal("");
  return <div>
    <button onClick={async () => setN(await api.get("a"))}>get</button>
    <button onClick={() => api.set("a", n())}>set</button>
    <button onClick={() => api.add(n())}>add</button>
    <button onClick={() => void api.delete("a")}>delete</button>
    <button onClick={() => { if (api.has("a")) setN("x"); }}>has</button>
    <button onClick={() => setN(api.from("x"))}>from</button>
    <p>{n()}</p>
  </div>;
}
