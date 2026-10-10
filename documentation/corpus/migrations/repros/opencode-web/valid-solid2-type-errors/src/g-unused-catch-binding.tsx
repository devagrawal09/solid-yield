import { createSignal } from "solid-js";
// `catch (e)` with an unused binding, under noUnusedLocals (as opencode-web's tsconfig).
export function G() {
  const [msg, setMsg] = createSignal("");
  const save = async () => {
    try {
      await fetch("/x");
      setMsg("ok");
    } catch (e) {
      setMsg("failed");
    }
  };
  return <button onClick={save}>{msg()}</button>;
}
