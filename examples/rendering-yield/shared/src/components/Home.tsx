import { $cleanup, component, $effect, $event, $signal, view } from "solid-yield";

const Home = component(function* Home() {
  const [s, set] = yield* $signal(0);

  // `onSettled(() => { …; return teardown })`: an effect with an empty
  // compute, whose effect phase runs once, after the first render (D-101),
  // and whose `$cleanup` runs when the component is disposed.
  const tick = $event(function* () {
    yield* set(n => n + 1);
  });
  yield* $effect(
    function* () {},
    function* () {
      const t = setInterval(tick, 100);
      yield* $cleanup(() => clearInterval(t));
    }
  );

  return view(function* () {
    return (
      <>
        <h1>Welcome to this Simple Routing Example</h1>
        <p>Click the links in the Navigation above to load different routes.</p>
        <span>{yield* s}</span>
      </>
    );
  });
});

export default Home;
