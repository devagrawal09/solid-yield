import blocksConfig from "../harness/eslint.config.mjs";

export default blocksConfig([
  {
    // The Solid × Effect integration layer, verbatim from examples/effect:
    // Effect's runtime / fiber generics are `any`-typed at this boundary
    // (ManagedRuntime<any, never>, Effect<any, any, any>). Not block code.
    files: ["src/solid-effect.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" }
  }
]);
