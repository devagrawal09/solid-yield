// The lint every `-yield` twin runs: eslint-plugin-solid-yield
// (recommended: every rule an error) plus no explicit `any`.
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import solidYield from "eslint-plugin-solid-yield";

// `files`: the routine code (default `src/`).
export default function yieldConfig(extra = [], files = ["src/**/*.{ts,tsx}"]) {
  return [
    { ignores: ["dist/**", "node_modules/**"] },
    {
      files,
      languageOptions: {
        parser: tsParser,
        // type information: `no-unyielded-write` reports any routine operation a
        // routine discards (an event call, a setter passed around, a bare attempt)
        parserOptions: {
          ecmaFeatures: { jsx: true },
          projectService: true,
          tsconfigRootDir: process.cwd()
        },
        ecmaVersion: 2024,
        sourceType: "module"
      },
      plugins: { "solid-yield": solidYield, "@typescript-eslint": tsPlugin },
      rules: {
        ...solidYield.configs.recommended.rules,
        "@typescript-eslint/no-explicit-any": "error"
      }
    },
    ...extra
  ];
}
