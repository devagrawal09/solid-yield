import { createContext, createEffect, For, Loading, useContext } from "solid-js";
import type { ParentProps } from "solid-js";
import { createConduit } from "./store";

const Ctx = createContext<ReturnType<typeof createConduit>>();
export function Provider(props: ParentProps) {
  const conduit = createConduit();
  return <Ctx value={conduit}>{props.children}</Ctx>;
}
function Page() {
  const [store, { loadComments }] = useContext(Ctx);
  createEffect(
    () => "a",
    s => {
      loadComments(s);
    }
  );
  return (
    <Loading fallback="...">
      <For each={store.comments()}>{c => <p>{c}</p>}</For>
    </Loading>
  );
}
export function App() {
  return (
    <Provider>
      <Page />
    </Provider>
  );
}
