import { render } from "@solidjs/web";
import { Errored, Loading } from "solid-js";
import { Checkout } from "./Checkout";
import { createRuntime, Runtime } from "./runtime";

render(
  () => (
    <Errored fallback={error => <p>{String(error())}</p>}>
      <Loading>
        <Runtime value={createRuntime(2)}>
          <Checkout />
        </Runtime>
      </Loading>
    </Errored>
  ),
  document.getElementById("root")!
);
