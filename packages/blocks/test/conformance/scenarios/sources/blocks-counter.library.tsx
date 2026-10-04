import { $component, $event, $memo, view } from "solid-blocks";
import { h } from "conformance";

export const App = $component(function* App() {
  h.run("setup");
  const [count, setCount] = yield* h.$signal("count", 1);
  const doubled = yield* $memo(function* () {
    h.run("doubled");
    return (yield* count) * 2;
  });
  const inc = $event(function* () {
    h.run("inc");
    yield* setCount((yield* count) + 1);
  });
  return view(function* () {
    return (
      <button class="inc" onClick={yield* inc}>
        {yield* count}:{yield* doubled}
      </button>
    );
  });
});
