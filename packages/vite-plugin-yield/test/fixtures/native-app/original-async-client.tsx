import { hydrate } from "@solidjs/web";
import { AsyncReads } from "./OriginalAsyncReads";
hydrate(AsyncReads, document.getElementById("root")!);
