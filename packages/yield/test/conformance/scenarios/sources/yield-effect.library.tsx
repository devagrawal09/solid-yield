import { $cleanup, component, $effect, $event, view } from "solid-yield";
import { h } from "conformance";

// The driver writes through events: a setter writes only when its receipt is
// delegated to inside a routine (D-021, D-028).
export let setA: (v: number) => unknown;
export let setFlag: (v: boolean) => unknown;
export let setC: (v: number) => unknown;

export const App = component(function* App() {
  const [a, sa] = yield* h.$signal("a", 1);
  const [flag, sf] = yield* h.$signal("flag", false);
  const [b, sb] = yield* h.$signal("b", 0);
  const [c, sc] = yield* h.$signal("c", 100);
  setA = $event(function* (v: number) {
    yield* sa(v);
  });
  setFlag = $event(function* (v: boolean) {
    yield* sf(v);
  });
  setC = $event(function* (v: number) {
    yield* sc(v);
  });
  // `$effect(compute, effect)` (D-079): Solid's split effect. The compute
  // tracks (the branch read of `c` is the effect's, not the view's, D-032);
  // the effect phase runs after it, untracked, and writes
  yield* $effect(
    function* () {
      const v = yield* a;
      return [v, yield* flag, v > 1 ? yield* c : undefined] as const;
    },
    function* ([v, f, cv]) {
      h.run("effect");
      yield* sb(v * 10);
      if (f) h.value("a", v);
      if (v > 1) h.value("c", cv);
      yield* $cleanup(() => h.log("cleanup", "effect " + v));
    }
  );
  return view(function* () {
    return <p class="b">{yield* b}</p>;
  });
});
