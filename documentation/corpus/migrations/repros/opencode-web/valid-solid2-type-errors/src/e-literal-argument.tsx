import { createSignal } from "solid-js";
declare function prompt(opts: { parts: { type: "text"; text: string }[] }): Promise<void>;
// A literal in an argument object, plus a reactive read in the same object.
export function E() {
  const [text] = createSignal("hi");
  const send = async () => {
    try {
      await prompt({ parts: [{ type: "text", text: text() }] });
    } catch {
      return;
    }
  };
  return <button onClick={send}>send</button>;
}
