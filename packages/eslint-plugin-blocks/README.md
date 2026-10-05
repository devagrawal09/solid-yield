# eslint-plugin-solid-blocks

ESLint rules for [`solid-blocks`](../blocks): the strict rules TypeScript cannot express.

**This is the strict dialect; the compiler route is the ergonomic one.** These rules, the types and the runtime's development errors together hold block code to the model. Each rule is listed in [`documentation/blocks-library.md`](../../documentation/blocks-library.md) §3, next to the type and runtime checks for the same rule.

```js
// eslint.config.mjs (flat config, ESLint 9)
import tsParser from "@typescript-eslint/parser";
import blocks from "eslint-plugin-solid-blocks";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      // type information: no-unyielded-write and no-component-tag use it
      parserOptions: { ecmaFeatures: { jsx: true }, projectService: true }
    },
    plugins: { "solid-blocks": blocks },
    rules: { ...blocks.configs.recommended.rules }
  }
];
```

`recommended` turns every rule on as an error, except `prefer-view-wrapper` and `no-unshown-wait` (warnings; the latter needs type information). Rule ids are `solid-blocks/<rule>`. Several rules have autofixes, for example tag → call for `no-component-tag`. The twins' shared config is `examples/harness/eslint.config.mjs`.

Every rule is listed with the type, development-error and transform codes for the same mistake in [`documentation/refusals.md`](../../documentation/refusals.md).

The refusal messages the rules share with the JSX transform are checked against [`vite-plugin-solid-blocks`](../vite-plugin-blocks)'s `rule.json`.

The package ships no type declarations: `test/exports-matrix.test.mjs` pins that TypeScript resolves none.
