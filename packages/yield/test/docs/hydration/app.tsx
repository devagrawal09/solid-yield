import { $event, $signal, component, view } from "solid-yield";
export const App = component(function* App() {
  const [count, setCount] = yield* $signal(0);
  const increment = $event(function* () {
    yield* setCount(n => n + 1);
  });
  return view(function* () {
    return <button onClick={yield* increment}>{yield* count}</button>;
  });
});
