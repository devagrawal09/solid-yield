/** @jsxImportSource @solidjs/web */
// The original's entry, typed for @solidjs/web's JSX: it mounts the app as
// the original does, pending pages included (see shared/src/components/App.tsx).
import { renderToStream } from "@solidjs/web";
import manifest from "virtual:solid-manifest";
import Shell from "../shared/src/components/Shell";
import App from "../shared/src/components/App";

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
