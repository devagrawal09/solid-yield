import { render } from "@solidjs/web";
import { createMemo, For, Errored } from "solid-js";
import { loadMessages } from "./api";

// Same pending read rendered directly (no router): failures handled, pending not.
function Direct() {
  const messages = createMemo(() => loadMessages("a"));
  return (
    <Errored fallback={() => <p>failed</p>}>
      <For each={messages()}>{(m) => <p>{m.text}</p>}</For>
    </Errored>
  );
}

render(() => <Direct />, document.getElementById("other")!);
