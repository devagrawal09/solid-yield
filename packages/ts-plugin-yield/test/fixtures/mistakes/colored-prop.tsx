import { createMemo } from "solid-js";
function TodoCount(props: { count: number }) {
  return <p>{props.count}</p>;
}
export function App() {
  const count = createMemo(async () => 1);
  return <TodoCount count={count()} />;
}
