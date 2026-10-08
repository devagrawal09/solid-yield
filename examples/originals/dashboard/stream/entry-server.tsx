import manifest from "virtual:solid-manifest";
import { renderToStream } from "@solidjs/web";
import App from "../src/app";
import { Shell } from "../src/shell";
export function render(url: string) {
  return renderToStream(
    () => (
      <Shell>
        <App url={url} />
      </Shell>
    ),
    { manifest }
  );
}
