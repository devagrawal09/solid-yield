/*
 * `solid-yield/internal`: the runtime itself, marks and helpers included,
 * for the package's own entries (`solid-yield`, `solid-yield/h`) to share
 * one copy of the runtime state. Not documented, no compatibility promise:
 * apps import `solid-yield` and `solid-yield/h`.
 */
export * from "./runtime.js";
