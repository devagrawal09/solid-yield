/** @jsxImportSource @solidjs/web */
// The original's entry, typed for @solidjs/web's JSX: it mounts the app as
// the original does, pending pages included (see shared/src/components/App.tsx).
import { render } from "@solidjs/web";
import { foreign } from "solid-yield";
import YieldApp from "../shared/src/components/App";

// the app handed to plain Solid: it may pend, and handles its failures (D-088)
const App = foreign(YieldApp);

render(() => <App />, document.getElementById("app")!);
