import { $event, attempt, raise, Failure, type EventHandler } from "solid-yield";
class Boom extends Failure("boom") {}
const inner = $event(function* () {
  yield* raise(Object.freeze(new Boom()));
});
const outer: EventHandler<[], never, void, false, false> = $event(function* () {
  yield* attempt(
    () => inner(),
    () => {}
  );
});
void outer;
