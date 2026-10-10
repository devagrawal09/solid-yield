import { action, createSignal } from "solid-js";

export function createCounter() {
  const [count, setCount] = createSignal(0);
  const store = { count, label: "n" };
  const actions = {
    inc: action(function* () {
      setCount(c => c + 1);
    })
  };
  const value: [typeof store, typeof actions] = [store, actions];
  return value;
}
