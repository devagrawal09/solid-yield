import { createMemo, For } from "solid-js";
import type { RouteProps } from "@solidjs/router";
import { loadMessages } from "./api";

// Async SDK-style call in a memo, rendered without Loading/Errored.
export default function SessionPage(props: RouteProps<"/session/:id">) {
  const messages = createMemo(() => loadMessages(props.params.id));
  return <For each={messages()}>{(m) => <p>{m.text}</p>}</For>;
}
