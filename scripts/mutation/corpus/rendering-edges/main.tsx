import { render } from "@solidjs/web";
import { Errored, Loading } from "solid-js";
import App from "./App";

// F-S53: a root tree of Solid's own boundaries is the entry's checked root (D-099).
render(
  () => (
    <Errored fallback={error => <p>{String(error())}</p>}>
      <Loading>
        <App />
      </Loading>
    </Errored>
  ),
  document.body
);
