import { createEffect } from "solid-js";
import { h } from "conformance";
export let setA, setFlag, setC;
export function App() {
  const [a, sa] = h.signal("a", 1);
  const [flag, sf] = h.signal("flag", false);
  const [b, sb] = h.signal("b", 0);
  const [c, sc] = h.signal("c", 100);
  setA = sa;
  setFlag = sf;
  setC = sc;
  createEffect(
    () => {
      const v = a();
      return [v, flag(), v > 1 ? c() : undefined];
    },
    ([v, f, cv]) => {
      h.run("effect");
      sb(v * 10);
      if (f) h.value("a", v);
      if (v > 1) h.value("c", cv);
      return () => h.log("cleanup", "effect " + v);
    }
  );
  return <p class="b">{b()}</p>;
}
