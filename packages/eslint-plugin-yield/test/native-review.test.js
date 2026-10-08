import { Linter } from "eslint";
import parser from "@typescript-eslint/parser";
import { readFileSync } from "node:fs";
import plugin from "../src/index.js";

const source = readFileSync(
  new URL("../../ts-plugin-yield/test/fixtures/review-app/src/App.tsx", import.meta.url),
  "utf8"
);
const lint = settings =>
  new Linter().verify(
    source,
    [
      {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "solid-yield": plugin },
        settings,
        rules: plugin.configs.recommended.rules
      }
    ],
    { filename: "src/App.tsx" }
  );

it("the reviewer's native app accepts plain Solid imports with the same file selection", () => {
  expect(lint({ "solid-yield": { mode: "native" } })).toEqual([]);
});
it("explicit files still require the yield primitives", () => {
  expect(
    lint({}).filter(d => d.ruleId === "solid-yield/no-foreign-reactive").length
  ).toBeGreaterThan(0);
});
