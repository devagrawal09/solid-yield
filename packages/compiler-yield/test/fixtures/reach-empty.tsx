import { component, view, hydrate, renderToString } from "solid-yield";
import "solid-yield/internal";
import { generateHydrationScript } from "@solidjs/web";
import { flush } from "solid-js";
const Empty = component(function* Empty() {
  return view(function* () {
    return <main />;
  });
});
export const serverHTML = () => generateHydrationScript() + renderToString(() => Empty({}));
export const resumeEmpty = () => hydrate(() => Empty({}), document.getElementById("root")!);
export const idle = () => flush();
