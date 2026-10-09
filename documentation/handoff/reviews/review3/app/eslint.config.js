import parser from "@typescript-eslint/parser";
import yieldLint from "eslint-plugin-solid-yield";
export default [{
  files: ["src/**/*.{ts,tsx}"],
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { "solid-yield": yieldLint },
  settings: { "solid-yield": { mode: "native" } },
  rules: yieldLint.configs.recommended.rules
}];
