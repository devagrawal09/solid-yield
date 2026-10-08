import { hydrate } from "@solidjs/web";
import App from "../src/app";
import { Shell } from "../src/shell";
hydrate(
  () => (
    <Shell>
      <App />
    </Shell>
  ),
  document
);
