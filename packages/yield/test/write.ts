/**
 * A write driven by a test, as a DOM event drives one: an `$event` (created
 * in a root) that delegates to the receipt the setter returns, dispatched
 * through a bind, as the DOM calls a handler a view binds. A setter called
 * with no routine running is a dev error (`SETTER_OUTSIDE_RUN`, D-028), so
 * the setter is called inside the event, and the event is bound, as the DOM
 * calls it (a direct call runs too, D-126, but its failures reach no
 * `Errored`).
 */
import { createRoot } from "solid-js";
import { $event } from "solid-yield";
import { bindEvent } from "solid-yield/internal";

export function write(make: () => Iterable<unknown>): void {
  const event = createRoot(() =>
    bindEvent(
      $event(function* () {
        yield* make() as Generator<never, unknown, unknown>;
      })
    )
  );
  void event();
}
