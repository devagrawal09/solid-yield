import { hydrate } from "@solidjs/web";
import { installServerComponents } from "@solidjs/web/frames";
import { installHosted } from "./hosted";
import { App } from "./app";
if ("__MODE__" === "hosted") installHosted();
else if ("__MODE__" === "high") installServerComponents();
export const dispose = hydrate(
  () => (
    <div id="root">
      <App />
    </div>
  ),
  document.body
);
