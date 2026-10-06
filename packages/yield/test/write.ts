/**
 * A write driven by a test, as a DOM event drives one: an `$event` (created
 * in a root, called from plain code) that delegates to the receipt the
 * setter returns. A setter called with no routine running is a dev error
 * (`SETTER_OUTSIDE_RUN`, D-028), so the setter is called inside the event.
 */
import { createRoot } from "solid-js";
import { $event } from "solid-yield";

export function write(make: () => Iterable<unknown>): void {
  const event = createRoot(() =>
    $event(function* () {
      yield* make() as Generator<never, unknown, unknown>;
    })
  );
  void event();
}
