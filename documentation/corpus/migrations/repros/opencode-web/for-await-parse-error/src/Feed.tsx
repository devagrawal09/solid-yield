import { createSignal, onSettled, For } from "solid-js";

declare function subscribe(): Promise<{ stream: AsyncIterable<{ text: string }> }>;

// opencode-web App/sse.ts shape: consume an SSE async iterable and write each event to state.
export function Feed() {
  const [lines, setLines] = createSignal<string[]>([]);
  onSettled(() => {
    const run = async () => {
      try {
        const sub = await subscribe();
        for await (const e of sub.stream) setLines((l) => [...l, e.text]);
      } catch (e) {
        setLines((l) => [...l, "stream failed"]);
      }
    };
    void run();
  });
  return <For each={lines()}>{(l) => <p>{l}</p>}</For>;
}
