import { createContext, createSignal, useContext, type Accessor, type Setter } from "solid-js";
import type { JSX } from "@solidjs/web";

interface Api { load(): Promise<string> }
interface Ctx { api: Accessor<Api | null>; setApi: Setter<Api | null>; last: Accessor<string>; setLast: Setter<string> }
const C = createContext<Ctx>();

export function Provider(props: { children: JSX.Element }) {
  const [api, setApi] = createSignal<Api | null>(null);
  const [last, setLast] = createSignal("");
  return <C value={{ api, setApi, last, setLast }}>{props.children}</C>;
}

// Dashboard-style context of signals; the read happens before any await.
export function Loader() {
  const { api, last, setLast } = useContext(C);
  const load = async () => {
    const client = api();
    if (!client) return;
    try {
      setLast(await client.load());
    } catch {
      setLast("failed");
    }
  };
  return <button onClick={load}>{last()}</button>;
}
