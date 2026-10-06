import yieldConfig from "../harness/eslint.config.mjs";

export default yieldConfig([
  {
    // The Solid × Effect integration layer, verbatim from examples/effect:
    // Effect's runtime / fiber generics are `any`-typed at this boundary
    // (ManagedRuntime<any, never>, Effect<any, any, any>). Not routine code.
    files: ["src/solid-effect.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" }
  }
]);
