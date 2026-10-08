// Exercise packed packages without workspace links or the repo's node_modules.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "fresh-app-"));
const run = (args, cwd = dir) => {
  try {
    return execFileSync("pnpm", args, { cwd, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    throw new Error(`${args.join(" ")}\n${e.stdout ?? ""}${e.stderr ?? ""}`);
  }
};
try {
  const packed = {},
    copied = {};
  for (const pkg of [
    "yield",
    "compiler-yield",
    "vite-plugin-yield",
    "ts-plugin-yield",
    "eslint-plugin-yield"
  ]) {
    const path = join(root, "packages", pkg);
    const manifest = JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
    for (const group of ["dependencies", "peerDependencies"])
      for (const value of Object.values(manifest[group] ?? {}))
        if (value.startsWith("workspace:"))
          throw new Error(`${pkg}: published workspace dependency`);
    run(["pack", "--pack-destination", dir], path);
    copied[manifest.name] = `file:${path}`;
    packed[manifest.name] = `file:${join(dir, `${manifest.name}-${manifest.version}.tgz`)}`;
  }
  for (const [mode, overrides] of [
    ["tarball", packed],
    ["file", copied]
  ]) {
    const app = join(dir, mode);
    mkdirSync(app);
    const fixture = join(root, "packages/ts-plugin-yield/test/fixtures/review-app");
    for (const file of ["src", "tsconfig.json", "vite.config.ts", "index.html"])
      cpSync(join(fixture, file), join(app, file), { recursive: true });
    writeFileSync(
      join(app, "package.json"),
      JSON.stringify(
        {
          name: "fresh-review-app",
          private: true,
          type: "module",
          dependencies: { ...overrides, "solid-js": "2.0.0-rc.13", "@solidjs/web": "2.0.0-rc.13" },
          devDependencies: {
            "@solidjs/vite-plugin": "3.0.0-next.47",
            vite: "^8.0.0",
            typescript: "6.0.3",
            eslint: "^9.0.0",
            "@typescript-eslint/parser": "^8.0.0"
          }
        },
        null,
        2
      )
    );
    writeFileSync(
      join(app, "pnpm-workspace.yaml"),
      `minimumReleaseAge: 0\nallowBuilds:\n  esbuild: true\noverrides:\n${Object.entries(overrides)
        .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
        .join("\n")}\n`
    );
    // Foreground, isolated install. No link: dependencies and no shared node_modules.
    run(["install", "--config.minimumReleaseAge=0"], app);
    run(["exec", "vite", "build"], app);
    const result = run(["exec", "solid-yield", "check", "."], app);
    if (!result.includes("0 errors")) throw new Error(result);
    writeFileSync(
      join(app, "eslint.config.mjs"),
      `import parser from "@typescript-eslint/parser";
import plugin from "eslint-plugin-solid-yield";
export default [{files:["src/**/*.{ts,tsx}"],languageOptions:{parser,parserOptions:{ecmaFeatures:{jsx:true}}},plugins:{"solid-yield":plugin},settings:{"solid-yield":{mode:"native"}},rules:plugin.configs.recommended.rules}];`
    );
    run(["exec", "eslint", "src"], app);
    console.log(
      `fresh-install: ${mode} plugins + compiler + runtime, isolated reviewer app build/check/lint PASS`
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
