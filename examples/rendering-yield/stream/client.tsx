// The original's entry, on the library's renderer (D-099): hydrates the tree
// the server rendered, the app under a `Loading` at the root, without a
// fallback (see ./entry-server.tsx).
import { hydrate, Loading } from "solid-yield";
import App from "../shared/src/components/App";
import Shell from "../shared/src/components/Shell";

hydrate(
  () =>
    Shell({
      clientEntry: "/client.tsx",
      children: function* () {
        return <>{yield* Loading({ children: App })}</>;
      }
    }),
  document
);
