import { hydrate } from "solid-yield";
import App from "../src/app";
import { Shell } from "../src/shell";
hydrate(
  () =>
    Shell({
      children: function* () {
        return <>{yield* App({})}</>;
      }
    }),
  document
);
