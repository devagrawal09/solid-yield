/** @jsxImportSource @solidjs/web */
// The original's entry, typed for @solidjs/web's JSX: it mounts the app as
// the original does, pending pages included (see shared/src/components/App.tsx).
import { hydrate } from "@solidjs/web";
import { foreign } from "solid-blocks";
import BlocksApp from "../shared/src/components/App";
import BlocksShell from "../shared/src/components/Shell";

// the block components handed to plain Solid: they may pend, and handle
// their own failures (D-088)
const App = foreign(BlocksApp);
const Shell = foreign(BlocksShell);

hydrate(
  () => (
    <Shell clientEntry="/client.tsx">
      <App />
    </Shell>
  ),
  document
);
