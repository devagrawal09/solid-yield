import { renderToStream, HydrationScript } from "@solidjs/web";
import { provideRequestEvent } from "@solidjs/web/storage";
import { ServerComponentPlugin, frameTransformDirectResult } from "@solidjs/web/frames";
import { configureServerFunctionsServer } from "@solidjs/web/server-functions";
import { App } from "./app";
if ("__MODE__" === "high")
  configureServerFunctionsServer({ transformDirectResult: frameTransformDirectResult });
if ("__MODE__" === "hosted")
  configureServerFunctionsServer({
    transformDirectResult(value, ctx) {
      const encoded = frameTransformDirectResult(value, ctx);
      return Object.assign(props => {
        const nodes = encoded(props);
        return [
          {
            t: nodes[0].t.replace("<solid-frame", "<main").replace(' style="display:contents"', "")
          },
          nodes[1],
          { t: "</main>" }
        ];
      }, encoded);
    }
  });
export function render(url) {
  globalThis._$HY = undefined;
  return provideRequestEvent({ request: new Request("http://localhost" + url), locals: {} }, () =>
    renderToStream(
      () => (
        <>
          <HydrationScript />
          <div id="root">
            <App url={url} />
          </div>
        </>
      ),
      { plugins: [ServerComponentPlugin] }
    )
  );
}
