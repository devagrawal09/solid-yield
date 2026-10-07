import { hydrate } from "@solidjs/web";
import { Counter } from "./Original";
hydrate(Counter, document.getElementById("root")!);
