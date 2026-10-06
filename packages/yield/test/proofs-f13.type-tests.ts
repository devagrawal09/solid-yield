import {
  createContext,
  component,
  view,
  $effect,
  raise,
  Failure,
  type HView,
  type Source
} from "solid-yield";
import { h } from "solid-yield/h";
import { For as SolidFor, type Element as SolidElement } from "solid-js";
class Boom extends Failure("boom") {}
const C = createContext<string, "C">(undefined, { name: "C" });
function Rows(p: { children?: (item: number) => SolidElement }) {
  const row = p.children;
  return row ? SolidFor({ each: [1], children: row }) : null;
}
const row = function* (_item: Source<number>) {
  const c = yield* C;
  yield* $effect(
    function* () {},
    function* () {
      yield* raise(new Boom());
    }
  );
  return view(function* () {
    return h("b", c);
  });
};
const rows = h(Rows, {}, row);
// F13: the row's setup belongs in GeneratorOps, like JSX RowOps.
// @ts-expect-error setup's context requirement cannot disappear
const withoutContext: HView<false, Boom, false, never> = rows;
// @ts-expect-error setup effect's failure cannot disappear
const withoutFailure: HView<false, never, false, typeof C> = rows;
const colored: HView<false, Boom, false, typeof C> = rows;
export const App = component(function* () {
  return view(function* () {
    return rows;
  });
});
void [withoutContext, withoutFailure, colored];
