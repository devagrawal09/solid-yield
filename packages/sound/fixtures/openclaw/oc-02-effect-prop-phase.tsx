// Reduced from ui/src/components/skill-file-hovercard.tsx:193–196; ui/src/pages/model-setup/model-setup-owner.ts @57d0e8e57ad (#179428)
// An effect helper consumes its input in the right phase — control. See README.md and D-131 for the frozen scope.
import { createSignal, createEffect } from "solid-js";
import { render } from "@solidjs/web";
function Child(props: { value: number }) {
  const apply = (value: number) => console.log(value);
  createEffect(() => props.value, value => apply(value));
  return <p>listener</p>;
}
function App() { const [count] = createSignal(1); return <Child value={count()} />; }

render(App, document.body);
