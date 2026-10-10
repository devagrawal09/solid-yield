import { createSignal, onSettled, For } from "solid-js";
import { render } from "@solidjs/web";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// opencode-web App/MessageInput shape (Solid 1 onMount -> Solid 2 onSettled): start
// background async work after mount, fire-and-forget, writing state as it goes.
function Feed() {
  const [lines, setLines] = createSignal<string[]>([]);
  onSettled(() => {
    let stopped = false;
    void (async () => {
      for (let i = 1; i <= 3 && !stopped; i++) {
        await wait(50);
        setLines((l) => [...l, `event ${i}`]);
      }
    })();
    return () => {
      stopped = true;
    };
  });
  return (
    <div id="feed">
      <For each={lines()}>{(l) => <p>{l}</p>}</For>
    </div>
  );
}

render(() => <Feed />, document.getElementById("root")!);
