// Run from the repository root. These are evidence checks, not rule overrides.
import assert from "node:assert/strict";
import { ESLint } from "../../../packages/eslint-plugin-yield/node_modules/eslint/lib/api.js";
import parser from "../../../packages/eslint-plugin-yield/node_modules/@typescript-eslint/parser/dist/index.js";
import plugin from "../../../packages/eslint-plugin-yield/src/index.js";

const namedByC3 = [
  "no-read-in-view-body",
  "yield-in-jsx-hole",
  "no-throw",
  "no-try-catch",
  "no-foreign-reactive",
  "no-unyielded-write",
  "component-call-yielded",
  "no-unchecked-foreign-handoff"
];
async function check(rules) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["documentation/calculus-proofs/probes/*.tsx"],
        languageOptions: {
          parser,
          parserOptions: {
            project: "./documentation/calculus-proofs/probes/tsconfig.json",
            tsconfigRootDir: process.cwd(),
            ecmaFeatures: { jsx: true }
          }
        },
        plugins: { "solid-yield": plugin },
        rules
      }
    ]
  });
  const results = await eslint.lintFiles([
    "documentation/calculus-proofs/probes/counterexamples.tsx"
  ]);
  return results.flatMap(result => result.messages);
}
const c3 = await check(Object.fromEntries(namedByC3.map(name => [`solid-yield/${name}`, "error"])));
assert.deepEqual(c3, [], "The eight C3 rules must accept the witness module");
console.log("C3's eight named rules: zero diagnostics");
const all = await check(plugin.configs.recommended.rules);
assert.equal(all.length, 1, JSON.stringify(all));
assert.equal(all[0].ruleId, "solid-yield/read-before-attempt");
assert.equal(all[0].severity, 2);
console.log("Full recommended: exactly the expected read-before-attempt diagnostic (F11)");
console.log("All other witness code has zero recommended-rule diagnostics");
