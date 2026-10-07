import { action, createSignal } from "solid-js";
export function CatchAction() {
  const [count, setCount] = createSignal(0);
  const save = action(function* () {
    try {
      yield Promise.reject("expected");
    } catch {
      setCount(count() + 1);
    }
  });
  return <button onClick={save}>{count()}</button>;
}
