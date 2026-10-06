import { createMemo } from "solid-js";
import { h } from "conformance";
export function App() {
  h.run("setup");
  const [count, setCount] = h.signal("count", 1);
  const doubled = createMemo(() => {
    h.run("doubled");
    return count() * 2;
  });
  const inc = () => {
    h.run("inc");
    setCount(count() + 1);
  };
  return (
    <button class="inc" onClick={inc}>
      {count()}:{doubled()}
    </button>
  );
}
