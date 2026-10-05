/*
 * `solid-blocks/internal`: the runtime itself, marks and helpers included,
 * for the package's own entries (`solid-blocks`, `solid-blocks/h`) to share
 * one copy of the runtime state. Not documented, no compatibility promise:
 * apps import `solid-blocks` and `solid-blocks/h`.
 */
export * from "./runtime.js";
