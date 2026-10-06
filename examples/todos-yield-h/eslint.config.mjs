import yieldConfig from "../harness/eslint.config.mjs";

export default yieldConfig([
  {
    // The data layer, verbatim from examples/todos (an optimistic store and
    // actions, not routine code): `TodoError.args: any[]` and the dispatch in
    // `retryTodo` keep the original's types.
    files: ["src/todos.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" }
  }
]);
