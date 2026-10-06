// The original's entry, on the library's renderer (D-099). `renderToString`
// is synchronous, so a pending read cannot wait: the original wraps the app
// in a `Loading` with a fallback page for async routes, and so does this
// one, at the root (and `./client.tsx`, which hydrates the same tree).
import manifest from "virtual:solid-manifest";
import { Loading, renderToString } from "solid-yield";
import App from "../shared/src/components/App";
import Shell from "../shared/src/components/Shell";

export function render(url: string) {
  return renderToString(
    () =>
      Shell({
        clientEntry: "/client.tsx",
        children: function* () {
          return (
            <>
              {
                yield* Loading({
                  fallback: function* () {
                    return <div>Loading…</div>;
                  },
                  children: () => App({ url })
                })
              }
            </>
          );
        }
      }),
    { manifest }
  );
}
