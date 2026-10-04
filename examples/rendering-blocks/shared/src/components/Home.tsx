import { $cleanup, $component, $event, $settled, $signal, view } from "@solidjs/blocks";

const Home = $component(function* Home() {
  const [s, set] = yield* $signal(0);

  // `onSettled(() => { …; return teardown })`: a run-once block whose
  // `$cleanup` runs when the component is disposed.
  const tick = $event(function* () {
    yield* set(n => n + 1);
  });
  yield* $settled(function* () {
    const t = setInterval(tick, 100);
    yield* $cleanup(() => clearInterval(t));
  });

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
