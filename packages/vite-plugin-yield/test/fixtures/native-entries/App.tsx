import { createMemo, lazy, type Component } from "solid-js";

const Page = lazy(() => import("./Page"));

function Frame(Comp: Component): Component {
  return () => (
    <main>
      <Comp />
    </main>
  );
}

export function Plain() {
  const n = createMemo(async () => 1);
  return (
    <section>
      <p>{n()}</p>
      <Page />
    </section>
  );
}

export const Framed = Frame(() => <p>framed</p>);
