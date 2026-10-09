import { createMemo } from "solid-js";
import { render } from "@solidjs/web";
function TodoCount(props: { count: number }) {
  return <p>{props.count}</p>;
}
export function App() {
  const count = createMemo(async () => 1);
  return <TodoCount count={count()} />;
}
render(App, document.body);
