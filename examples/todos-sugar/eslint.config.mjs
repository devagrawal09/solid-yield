import yieldConfig from "../harness/eslint.config.mjs";
export default yieldConfig(
  [
    {
      files: [".generated/src/**/*.{ts,tsx}"],
      languageOptions: {
        parserOptions: { projectService: false, project: "./tsconfig.generated.json" }
      }
    },
    { files: [".generated/src/todos.ts"], rules: { "@typescript-eslint/no-explicit-any": "off" } }
  ],
  [".generated/src/**/*.{ts,tsx}"]
);
