import manifest from "virtual:solid-manifest";
import { renderToStream } from "solid-yield";
import App from "../src/app";
import { Shell } from "../src/shell";
export function render(url: string) {
  return renderToStream(
    () =>
      Shell({
        children: function* () {
          return <>{yield* App({ url })}</>;
        }
      }),
    { manifest }
  );
}
