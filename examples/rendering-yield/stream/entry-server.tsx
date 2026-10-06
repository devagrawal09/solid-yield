// The original's entry, on the library's renderer (D-099): the app is pending
// at its root by design (see shared/src/components/App.tsx), so it is wrapped
// in a `Loading` at the root, without a fallback, as the original showed
// nothing until it settled.
import manifest from "virtual:solid-manifest";
import { Loading, renderToStream } from "solid-yield";
import App from "../shared/src/components/App";
import Shell from "../shared/src/components/Shell";

export function render(url: string) {
  return renderToStream(
    () =>
      Shell({
        clientEntry: "/client.tsx",
        children: function* () {
          return <>{yield* Loading({ children: () => App({ url }) })}</>;
        }
      }),
    { manifest }
  );
}
