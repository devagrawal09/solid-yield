/*
 * `solid-yield/internal`: the runtime itself, marks and helpers included,
 * for the package's own entries (`solid-yield`, `solid-yield/h`) to share
 * one copy of the runtime state. Not documented, no compatibility promise:
 * apps import `solid-yield` and `solid-yield/h`.
 */
export * from "./runtime.js";
export {
  NativeFailure,
  nativeFailure,
  nativeFailureValue,
  registerNativeFailure
} from "./native-failure.js";
export type { NativeCaught } from "./native-failure.js";

export {
  nativeTry,
  nativeMap,
  nativeCallback,
  nativeInvoke,
  nativeDispatch
} from "./native-control.js";

export type { NativeArguments } from "./native-control.js";
export { nativeC } from "./native-props.js";
export type { NativeProps } from "./native-props.js";
