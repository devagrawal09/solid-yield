import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import babel from "../../packages/vite-plugin-yield/node_modules/@babel/core/lib/index.js";
import { fixtures } from "../native/fixtures.mjs";
export const root = resolve(import.meta.dirname, "../..");
function files(dir) {
  return new Map(
    readdirSync(resolve(root, dir), { recursive: true })
      .filter(f => /\.[jt]sx?$/.test(f))
      .sort()
      .map(f => [f, readFileSync(resolve(root, dir, f), "utf8")])
  );
}
export function corpus() {
  const projects = ["sierpinski", "todos"].map(id => ({
    id,
    origin: `examples/originals/${id}/src (verbatim)`,
    files: files(`examples/originals/${id}/src`)
  }));
  const base = files("scripts/mutation/corpus/reviewer/base");
  projects.push({
    id: "reviewer-myapp",
    origin: "/private/tmp/sy-review-out/myapp/src (verbatim snapshot)",
    files: base
  });
  for (const [file, source] of files("scripts/mutation/corpus/reviewer/variants")) {
    projects.push({
      id: "reviewer-" + file.replace(".tsx", ""),
      origin: "/private/tmp/sy-review-out/variants/" + file + " (verbatim snapshot)",
      files: new Map([...base].map(([f, c]) => [f, f === "App.tsx" ? source : c]))
    });
  }
  for (const fixture of fixtures.filter(f => f.slots)) {
    const source = babel.transformSync(fixture.source, {
      configFile: false,
      babelrc: false,
      filename: "review.tsx",
      parserOpts: { plugins: ["typescript", "jsx"] }
    }).code;
    projects.push({
      id: "review-slots-" + fixture.id,
      origin: "scripts/native/fixtures.mjs; reconstructed slots " + fixture.slots.join(", "),
      files: new Map([["App.tsx", source]])
    });
  }
  projects.push({
    id: "operator-seeds",
    origin: "Additional plain Solid controls for catch, async event and server sites",
    files: files("scripts/mutation/corpus/seeds")
  });
  projects.push({
    id: "sugar-edges",
    origin:
      "Plain Solid exercising the native edges: context hooks and members, setters in plain types, wrappers with boundaries around context readers, array callbacks, effect cleanups, an anonymous default component",
    files: files("scripts/mutation/corpus/sugar-edges")
  });
  return projects;
}
export const relativeToRoot = file => relative(root, file);
