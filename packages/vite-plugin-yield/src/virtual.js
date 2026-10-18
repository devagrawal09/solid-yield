/** Shared pre-JSX virtual code API. Runtime lowering and typing use these exact
 * implementations; the language service never reconstructs library colors. */
export { lowerNativeProject } from "./native.js";
export { locate } from "./positions.js";
export { nativeInclude } from "./selection.js";
