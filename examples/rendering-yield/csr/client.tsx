// The original's entry, on the library's renderer (D-099): the app is pending
// at its root by design (see shared/src/components/App.tsx), so it is wrapped
// in a `Loading` at the root. Without a fallback, as the original's
// `render()` deferred the mount: nothing shows until the app settles.
import { Loading, render } from "solid-yield";
import App from "../shared/src/components/App";

render(() => Loading({ children: App }), document.getElementById("app")!);
