import { $component, $event, view, type Props } from "solid-blocks";
import { h } from "conformance";

export let setLabel: (v: string) => unknown;
export let setOther: (v: number) => unknown;

const Child = $component(function* Child(props: Props<{ label: string }>) {
  h.run("child setup");
  return view(function* () {
    return <span class="child">{yield* props.label}</span>;
  });
});

export const App = $component(function* App() {
  h.run("app setup");
  const [label, sl] = yield* h.$signal("label", "a");
  const [other, so] = yield* h.$signal("other", 0);
  setLabel = $event(function* (v: string) {
    yield* sl(v);
  });
  setOther = $event(function* (v: number) {
    yield* so(v);
  });
  return view(function* () {
    return (
      <div>
        {yield* Child({ label })}
        <i>{yield* other}</i>
      </div>
    );
  });
});
