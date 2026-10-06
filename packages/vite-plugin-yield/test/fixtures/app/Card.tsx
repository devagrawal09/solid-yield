// A fixture app for the source-map test (test/vite.test.js): holes rewritten
// above the deliberate throw, and a hole on the same line as a call.
import { $component, type Props, view } from "solid-yield";
import { renderToString } from "@solidjs/web";

export const Card = $component(function* Card(props: Props<{ title: string; n: number }>) {
  return view(function* () {
    return (
      <article title={yield* props.title}>
        <h2>{yield* props.title}</h2>
        <p>
          {yield* props.n} items, {(yield* props.n) > 1 ? "many" : "one"} {label(yield* props.n)}
        </p>
      </article>
    );
  });
});

export function label(n: number): string {
  return n < 0 ? fail(`negative count: ${n}`) : String(n);
}

export function fail(message: string): never {
  throw new Error(`deliberate: ${message}`);
}

// Server-renders the card: a negative count throws from the `label(…)` hole.
export function page(n: number): string {
  return renderToString(() => Card({ title: "Cart", n }) as never);
}
