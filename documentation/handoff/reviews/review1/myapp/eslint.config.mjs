import tsParser from "@typescript-eslint/parser";
import solidYield from "eslint-plugin-solid-yield";
export default [{
  files: ["src/**/*.{ts,tsx}"],
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true }, projectService: true } },
  plugins: { "solid-yield": solidYield },
  rules: { ...solidYield.configs.recommended.rules }
}];
