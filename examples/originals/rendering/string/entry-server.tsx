import { Loading } from "solid-js";
import { renderToString } from "@solidjs/web";
import manifest from "virtual:solid-manifest";
import Shell from "../shared/src/components/Shell";
import App from "../shared/src/components/App";

// `renderToString` is fully synchronous, so an uncaught async read throws.
// Wrap `<App />` in a `<Loading>` here (and in `./client.tsx`) so sync SSR
// can emit a fallback page for async routes. Streaming SSR and CSR don't
// need this -- streaming holds the response and `render()` defers the
// initial mount.
export function render(url: string) {
  return renderToString(
    () => (
      <Shell clientEntry="/client.tsx">
        <Loading fallback={<div>Loading…</div>}>
          <App url={url} />
        </Loading>
      </Shell>
    ),
    { manifest }
  );
}
