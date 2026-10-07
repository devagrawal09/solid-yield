import { hydrate } from "@solidjs/web";
import { CatchAction } from "./OriginalCatchAction";
hydrate(CatchAction, document.getElementById("root")!);
