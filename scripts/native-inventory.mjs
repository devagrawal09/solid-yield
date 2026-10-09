// Actual imports across the nine original inputs; status describes lowering,
// not application parity. The verification report owns that separate claim.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { parseProgram } from "../packages/vite-plugin-yield/src/transform.js";
import { nativeTypeMapping } from "../packages/vite-plugin-yield/src/native-types.js";
import {
  nativeMapping,
  nativePassthrough,
  nativeTypes
} from "../packages/vite-plugin-yield/src/native.js";
const root = resolve(import.meta.dirname, "..");
const scan = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.name === "node_modules"
      ? []
      : e.isDirectory()
        ? scan(join(dir, e.name))
        : /\.[tj]sx?$/.test(e.name)
          ? [join(dir, e.name)]
          : []
  );
const entries = new Set([
  "render",
  "hydrate",
  "renderToString",
  "renderToStream",
  "HydrationScript"
]);
const foreignTags = new Set(["Portal", "Reveal"]);
const outside = new Set([
  "Portal",
  "Reveal",
  "dynamic",
  "lazy",
  "until",
  "createProjection",
  "latest",
  "isPending",
  "Repeat",
  "createUniqueId",
  "onSettled",
  "onCleanup",
  "markSafeError",
  "getRequestEvent",
  "isServer"
]);
const rows = new Map();
for (const name of [
  "docs",
  "effect",
  "hackernews-spa",
  "rendering",
  "room",
  "sierpinski",
  "todos"
]) {
  const dir = join(root, "examples/originals", name, name === "rendering" ? "shared/src" : "src");
  for (const file of scan(dir))
    parseProgram(readFileSync(file, "utf8"), file)?.traverse({
      ImportDeclaration(p) {
        const module = p.node.source.value;
        if (!["solid-js", "@solidjs/web"].includes(module)) return;
        for (const spec of p.node.specifiers) {
          if (spec.type !== "ImportSpecifier") continue;
          const api = spec.imported.name ?? spec.imported.value,
            key = module + ":" + api;
          let form = nativeMapping[api],
            status = "mapped",
            reason = "";
          if (entries.has(api)) {
            status = "excluded-as-entry";
            form = "Solid entry API + foreign(component) at direct handoffs";
          } else if (foreignTags.has(api)) {
            status = "foreign-jsx";
            form = "foreign(Tag); retain JSX props and children";
            reason =
              "Plain Solid tag; NATIVE_FOREIGN_BOUNDARY reports unknown foreign failures. Complete-original capture/parity remains unverified.";
          } else if (nativeTypes.has(api)) {
            const mapped = nativeTypeMapping[api];
            form = mapped
              ? `type import -> ${mapped[0]} ${mapped[1]}`
              : api === "JSX"
                ? "JSX.Element -> solid-yield Element"
                : "retained type-only; NATIVE_TYPE_UNMAPPED at annotations";
            reason =
              api === "JSX"
                ? "Other JSX contracts are retained with NATIVE_TYPE_UNMAPPED."
                : mapped
                  ? "Declaration bodies infer their colors; annotated contracts use the library defaults."
                  : "No native type mapping; original annotation retained.";
          } else if (api === "useContext") form = "context source read";
          else if (api === "onSettled") form = "$effect + $cleanup";
          else if (nativePassthrough.has(api)) form = "pass-through";
          else if (!(api in nativeMapping)) {
            status = "refused-with-reason";
            reason = "NATIVE_API: no native mapping";
          }
          if (
            [
              "until",
              "latest",
              "isPending",
              "lazy",
              "createProjection",
              "createOptimisticStore",
              "createStore"
            ].includes(api)
          )
            reason =
              "Primitive import is mapped; not every overload, selector, or callback contract is implemented. See application diagnostics.";
          if (!rows.has(key))
            rows.set(key, {
              module,
              api,
              status,
              form,
              reason,
              intendedScope: entries.has(api)
                ? "entry"
                : nativeTypes.has(api)
                  ? "type"
                  : outside.has(api)
                    ? "foreign"
                    : "core",
              files: []
            });
          rows.get(key).files.push(relative(root, file));
        }
      }
    });
}
const report = {
  note: "Seven source trees feed nine twin parity targets (JSX/h variants). Mapping is not a parity result. No produce import occurs.",
  apis: [...rows.values()].sort((a, b) =>
    (a.module + ":" + a.api).localeCompare(b.module + ":" + b.api)
  )
};
const text = JSON.stringify(report, null, 2) + "\n",
  file = join(root, "documentation/native-api-inventory.json");
if (process.argv.includes("--write")) writeFileSync(file, text);
else if (readFileSync(file, "utf8") !== text)
  throw new Error("Native API inventory changed; rerun with --write.");
console.log(`native API inventory: ${report.apis.length} imported module/API pairs`);
