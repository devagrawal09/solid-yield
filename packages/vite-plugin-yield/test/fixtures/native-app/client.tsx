import { hydrate } from "solid-yield";
import { Counter } from "./Counter";
hydrate(Counter, document.getElementById("root")!);
