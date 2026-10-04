/** @jsxImportSource @solidjs/web */
// The original's entry, typed for @solidjs/web's JSX: it mounts the app as
// the original does, pending pages included (see shared/src/components/App.tsx).
import { render } from "@solidjs/web";
import App from "../shared/src/components/App";

render(() => <App />, document.getElementById("app")!);
