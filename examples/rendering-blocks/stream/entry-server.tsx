/** @jsxImportSource @solidjs/web */
// The original's entry, typed for @solidjs/web's JSX: it mounts the app as
// the original does, pending pages included (see shared/src/components/App.tsx).
import { renderToStream } from "@solidjs/web";
import manifest from "virtual:solid-manifest";
import { foreign } from "solid-blocks";
import BlocksApp from "../shared/src/components/App";
import BlocksShell from "../shared/src/components/Shell";

// the block components handed to plain Solid: they may pend, and handle
// their own failures (D-088)
const App = foreign(BlocksApp);
const Shell = foreign(BlocksShell);

export function render(url: string) {
  return renderToStream(
    () => (
      <Shell clientEntry="/client.tsx">
        <App url={url} />
      </Shell>
    ),
    { manifest }
  );
}
