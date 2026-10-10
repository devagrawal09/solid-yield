import { createMemo, createSignal } from "solid-js";

interface Route {
  name: string;
}

export function App() {
  const [path, setPath] = createSignal("home");
  // Explicit type argument (valid Solid 2).
  const a = createMemo<Route | undefined>(() => (path() ? { name: path() } : undefined));
  // Annotated return type on the compute function (valid Solid 2).
  const b = createMemo((): Route | undefined => (path() ? { name: path() } : undefined));
  return (
    <button onClick={() => setPath("other")}>
      {a()?.name} {b()?.name}
    </button>
  );
}
