// The lint every `-blocks` twin runs: eslint-plugin-solid-blocks
// (recommended: every rule an error) plus no explicit `any`.
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import blocks from "eslint-plugin-solid-blocks";

// `files`: the block code (default `src/`).
export default function blocksConfig(extra = [], files = ["src/**/*.{ts,tsx}"]) {
  return [
    { ignores: ["dist/**", "node_modules/**"] },
    {
      files,
      languageOptions: {
        parser: tsParser,
        // type information: `no-unyielded-write` reports any block operation a
        // block discards (an event call, a setter passed around, a bare attempt)
        parserOptions: {
          ecmaFeatures: { jsx: true },
          projectService: true,
          tsconfigRootDir: process.cwd()
        },
        ecmaVersion: 2024,
        sourceType: "module"
      },
      plugins: { "solid-blocks": blocks, "@typescript-eslint": tsPlugin },
      rules: {
        ...blocks.configs.recommended.rules,
        "@typescript-eslint/no-explicit-any": "error"
      }
    },
    ...extra
  ];
}
