// @ts-check
// The null prototype reports nothing. It exists so the harness demonstrably
// flags missed obligations: every in-subset expectation is a soundness failure
// against it.
/** @type {import("../src/types.d.ts").Prototype} */
export const nullPrototype = {
  name: "null",
  createChecker() {
    return {
      check: () => ({ diagnostics: [], elapsedMs: 0 }),
      update: () => ({ diagnostics: [], elapsedMs: 0 }),
      dispose() {}
    };
  }
};
export const name = nullPrototype.name;
export const createChecker = nullPrototype.createChecker;
