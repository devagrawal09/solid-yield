import { createContext } from "solid-yield";
declare const __DEV__: boolean;
it.skipIf(!__DEV__)("JavaScript must pass the runtime name too", () => {
  const untypedCreate = createContext as () => unknown;
  expect(() => untypedCreate()).toThrow(/\[CONTEXT_NAME\].*runtime name/);
});
