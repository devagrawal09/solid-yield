import { hydrate, ChunkError, registerFailure } from "solid-yield";
import {
  configureServerFunctionsClient,
  createServerReference
} from "@solidjs/web/server-functions/client";
import { App } from "./app.jsx";
// Also pin the published entries' single shared Failure base/registry.
registerFailure(ChunkError, "rpc/ChunkError");
export function start(fetcher: typeof fetch, which: string) {
  configureServerFunctionsClient({ fetch: fetcher });
  const rpc = createServerReference("wire-missing");
  return hydrate(() => App({ invoke: () => rpc(which) }), document.getElementById("app")!);
}
