import { For, Show } from "solid-js";

// Same component twice: message/part types are `any` (as in opencode-web's api/client.ts)
// vs. structural types. Only the `any` version fails.
type Message = any;
type Part = any;

export function Item(props: { message: { info: Message; parts: Part[] } }) {
  const isUser = () => props.message.info.role === "user";
  return (
    <div class={isUser() ? "user" : "assistant"}>
      <For each={props.message.parts}>
        {(part) => (
          <Show when={part.type === "text"}>
            <span>{part.text}</span>
          </Show>
        )}
      </For>
    </div>
  );
}

export function TypedItem(props: { message: { info: { role: string }; parts: { type: string; text?: string }[] } }) {
  const isUser = () => props.message.info.role === "user";
  return (
    <div class={isUser() ? "user" : "assistant"}>
      <For each={props.message.parts}>
        {(part) => (
          <Show when={part.type === "text"}>
            <span>{part.text}</span>
          </Show>
        )}
      </For>
    </div>
  );
}
