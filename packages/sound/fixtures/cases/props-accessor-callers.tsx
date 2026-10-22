import { createSignal } from "solid-js";
interface ViewProps { count: () => number }
function View(props: ViewProps) {
  return <p>{props.count()}</p>;
}
function Inline(props: { count: () => number }) {
  return <p>{props.count()}</p>;
}
export function App() {
  const [n] = createSignal(1);
  return (
    <>
      <View count={n} />
      <View count={() => 2} />
      <View count={() => n() * 2} />
      <Inline count={n} />
      <Inline count={() => n() + 1} />
    </>
  );
}