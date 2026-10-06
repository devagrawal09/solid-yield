import { createContext, component, view, type HView, type Source } from "solid-yield";
import { h } from "solid-yield/h";
const C = createContext<string, "C">(undefined, { name: "C" });
const Reader = component(function* () {
  const c = yield* C;
  return view(function* () {
    return h("b", c);
  });
});
// F07: Fragment folds context requirements, failure, pending and may-wait.
// @ts-expect-error Fragment cannot erase the Reader's requirement
const settled: HView<false, never, false, never> = h.Fragment({ children: h(Reader, {}) });
declare const pending: Source<string, never, true>;
// @ts-expect-error Fragment cannot erase pending
const sync: HView<false, never> = h.Fragment({ children: ["prefix", pending] });
declare const failing: Source<string, Error>;
// @ts-expect-error Fragment cannot erase failures
const infallible: HView<false, never> = h.Fragment({ children: failing });
const plain: HView<false, never, false, never> = h.Fragment({ children: ["ok", h("b", "text")] });
void [settled, sync, infallible, plain];
