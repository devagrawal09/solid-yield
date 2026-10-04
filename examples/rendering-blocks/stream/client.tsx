/** @jsxImportSource @solidjs/web */
// The original's entry, typed for @solidjs/web's JSX: it mounts the app as
// the original does, pending pages included (see shared/src/components/App.tsx).
import { hydrate } from "@solidjs/web";
import Shell from "../shared/src/components/Shell";
import App from "../shared/src/components/App";

hydrate(
  () => (
    <Shell clientEntry="/client.tsx">
      <App />
    </Shell>
  ),
  document
);
