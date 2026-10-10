import { createSignal, onSettled } from "solid-js";
import { render } from "@solidjs/web";
import { subscribe } from "../lib/ticker";

// opencode-web's virtualizer adapter shape: the raw signal setter is the package callback.
function Ticks() {
  const [ticks, setTicks] = createSignal(0);
  onSettled(() => subscribe(setTicks));
  return <p id="ticks">{ticks()}</p>;
}

render(() => <Ticks />, document.getElementById("root")!);
