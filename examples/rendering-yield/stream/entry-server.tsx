/** @jsxImportSource @solidjs/web */
// The original's entry, typed for @solidjs/web's JSX: it mounts the app as
// the original does, pending pages included (see shared/src/components/App.tsx).
import { renderToStream } from "@solidjs/web";
import manifest from "virtual:solid-manifest";
import { foreign } from "solid-yield";
import YieldApp from "../shared/src/components/App";
import YieldShell from "../shared/src/components/Shell";

// the yield components handed to plain Solid: they may pend, and handle
// their own failures (D-088)
const App = foreign(YieldApp);
const Shell = foreign(YieldShell);

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
