import { Failure } from "solid-yield";
import { component, view, $effect, raise, Errored, Loading, type Source } from "solid-yield";
import { h } from "solid-yield/h";
class Boom extends Failure("boom") {}
const Child = component(function* () {
  yield* $effect(
    function* () {},
    function* () {
      yield* raise(new Boom("early"));
    }
  );
  return view(function* () {
    return <b>child</b>;
  });
});
// F08: JS evaluates Child before creating h's boundary.
// @ts-expect-error [LAZY_VIEW] children must be built under Errored
h(Errored, { fallback: "caught" }, Child());
// @ts-expect-error the render fallback overload also refuses an eager child
h(Errored, { fallback: () => "caught" }, Child());
// @ts-expect-error Loading cannot discharge an eager child either
h(Loading, { fallback: "wait" }, Child());
// @ts-expect-error arrays do not hide eager children
h(Errored, { fallback: "caught" }, [Child()]);
h(Errored, { fallback: "caught" }, h(Child, {}));
h(Errored, { fallback: "caught" }, function* () {
  return yield* Child();
});
declare const pending: Source<string, never, true>;
// @ts-expect-error a source must be read inside lazy children, not passed as content
h(Loading, {}, pending);
h(Loading, {}, function* () {
  return yield* pending;
});
