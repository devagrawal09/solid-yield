import { createMemo, For, Loading, Errored } from "solid-js";
import type { RouteProps } from "@solidjs/router";
import { loadMessages } from "./api";

// The same page with its own boundaries.
export default function SafeSessionPage(props: RouteProps<"/safe/:id">) {
  const messages = createMemo(() => loadMessages(props.params.id));
  return (
    <Errored fallback={(err) => <p>failed: {err() instanceof Error ? (err() as Error).message : "unknown"}</p>}>
      <Loading fallback={<p>loading</p>}>
        <For each={messages()}>{(m) => <p>{m.text}</p>}</For>
      </Loading>
    </Errored>
  );
}
