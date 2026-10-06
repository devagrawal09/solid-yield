// The original's entry, on the library's renderer (D-099). Mirrors the string
// server entry: the app under a `Loading` with the original's fallback page,
// so hydration renders the same tree.
import { hydrate, Loading } from "solid-yield";
import App from "../shared/src/components/App";
import Shell from "../shared/src/components/Shell";

hydrate(
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
                children: App
              })
            }
          </>
        );
      }
    }),
  document
);
