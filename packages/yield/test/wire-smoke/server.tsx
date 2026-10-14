import { generateHydrationScript, createRequestEvent } from "@solidjs/web";
import { provideRequestEvent } from "@solidjs/web/storage";
import {
  registerServerFunction,
  handleServerFunctionRequest,
  configureServerFunctionsServer,
  setServerFunctionsDev
} from "@solidjs/web/server-functions/server";
import { renderToStream } from "solid-yield";
import { App } from "./app.jsx";
import { NotFound, Sibling } from "./classes.js";
configureServerFunctionsServer({
  provideEvent: (event, fn) => provideRequestEvent(createRequestEvent(event.request, event), fn)
});
setServerFunctionsDev(false);
registerServerFunction("wire-missing", (which: string) => {
  throw which === "sibling" ? new Sibling("RPC sibling") : new NotFound("RPC missing");
});
export const handle = (request: Request) => handleServerFunctionRequest(request);
export async function page() {
  const body = String(await renderToStream(() => App({ invoke: async () => "unused on server" })));
  return `<!doctype html><html><head>${generateHydrationScript()}</head><body><div id="app">${body}</div></body></html>`;
}
