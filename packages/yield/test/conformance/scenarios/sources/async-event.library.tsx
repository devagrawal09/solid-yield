import { $component, $event, attempt, Errored, view } from "solid-yield";
import { h, Forbidden } from "conformance";

const forbidden = (cause: unknown) =>
  cause instanceof Forbidden ? cause : new Forbidden(String(cause));
const caught = (error: unknown) => (h.caught("boundary", error), (error as Error).name);

const Saver = $component(function* Saver() {
  const [status, ss] = yield* h.$signal("status", "idle");
  // a DOM dispatch ignores the call's promise, so its failure goes to the
  // Errored above where the event is bound (D-085)
  const save = $event(function* () {
    h.run("save");
    yield* ss("saving");
    const answer = yield* attempt(() => h.task<string>("save"), forbidden);
    yield* ss(answer);
  });
  return view(function* () {
    return (
      <button class="save" onClick={yield* save}>
        {yield* status}
      </button>
    );
  });
});

export const App = $component(function* App() {
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: err => <p class="err">{caught(err())}</p>,
            children: function* () {
              return <>{yield* Saver({})}</>;
            }
          })
        }
      </>
    );
  });
});
