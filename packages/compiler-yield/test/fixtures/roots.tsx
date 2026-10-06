import { Hydration, NoHydration } from "solid-js";
import { HydrationScript, renderToString } from "@solidjs/web";
import { component, $signal, $event, view, foreign, hydrate } from "solid-yield";

const Counter = component(function* Counter() {
  const [n, set] = yield* $signal(0);
  const increment = $event(function* () {
    yield* set(value => value + 1);
  });
  return view(function* () {
    return <button onClick={yield* increment}>{yield* n}</button>;
  });
});
const ForeignCounter = foreign(Counter);
export function serverDocument() {
  return renderToString(
    () => (
      <>
        <HydrationScript />
        <NoHydration>
          <main>
            <h1>Inert heading</h1>
            <section id="first">
              <Hydration id="first">{ForeignCounter()}</Hydration>
            </section>
            <section id="second">
              <Hydration id="second">{ForeignCounter()}</Hydration>
            </section>
          </main>
        </NoHydration>
      </>
    ),
    { renderId: "outer" }
  );
}
export function hydrateRoot(id: string) {
  return hydrate(Counter, document.getElementById(id)!, { renderId: id });
}
