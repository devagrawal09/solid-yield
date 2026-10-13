// The same booking page three times, side by side. The pages show the same
// markup and obey the same rules (tests/booking.test.tsx). Only the location
// of the state and the wiring are different.
import { component, view } from "solid-yield";
import { BookingPage as Before } from "./before/booking";
import { BookingPage as After } from "./after/booking";
import { BookingPage as LensProp } from "./lens-prop/booking";

export const App = component(function* App() {
  return view(function* () {
    return (
      <main>
        <div class="column before">
          <h2>Before: lifted state</h2>
          {yield* Before()}
        </div>
        <div class="column after">
          <h2>Slots and compose</h2>
          {yield* After()}
        </div>
        <div class="column lens-prop">
          <h2>Lens props</h2>
          {yield* LensProp()}
        </div>
      </main>
    );
  });
});
