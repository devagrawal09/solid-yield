import { createContext, useContext } from "solid-js";
import type { ParentProps } from "solid-js";
import { createCounter } from "./store";

const Ctx = createContext<ReturnType<typeof createCounter>>();
export function Provider(props: ParentProps) {
  const counter = createCounter();
  return <Ctx value={counter}>{props.children}</Ctx>;
}
export function useCounter() {
  return useContext(Ctx);
}
function Button() {
  const [store, { inc }] = useCounter();
  return <button onClick={() => inc()}>{store.label} {store.count()}</button>;
}
export function App() {
  return (
    <Provider>
      <Button />
    </Provider>
  );
}
