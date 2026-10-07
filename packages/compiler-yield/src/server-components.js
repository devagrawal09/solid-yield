import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { parseProgram } from "../../vite-plugin-yield/src/transform.js";
import { extractModule } from "./emit.js";
import { analyzeRecomputable } from "./recomputable.js";
import { createHash } from "node:crypto";
const require = createRequire(new URL("../../vite-plugin-yield/package.json", import.meta.url));
const MagicString = require("magic-string");

/** Docs C3 lowering. Called after eagerIslands({roots:"single"}), before the
 * yield/Solid transforms. Uses Solid's public server functions and frame slots.
 */
export default function serverComponents({ directory }) {
  const dir = resolve(directory);
  const content = resolve(dir, "src/content.tsx");
  const remote = resolve(dir, "src/__compiler_regions.tsx");
  const stub = resolve(dir, "src/__compiler_refetch.tsx");
  const code = readFileSync(content, "utf8");
  const program = parseProgram(code, content);
  // This is a deliberately bounded docs lowering, not a general region emitter.
  // Refuse changed setup/wrapper shapes rather than silently drop authored work.
  const shapes = {
    Home: "46437202127c8650421e98e8784c60d299c1f89a7ada287724cd6dc3b1336dda",
    DocPage: "9287ad2aa9507b792b7d0341f75b2de222d1a71d5c364ada70553efa001e6c3d",
    ArticleContent: "1d78f9f4f9ffa957468ae4ff99b484cde1ac86d4741abec0bc7d756f5854b084",
    ReadingGuide: "83c3d9bbe68a1bf419b8f4751de8508d7d50cd1bee321e0681a8d2dccfa7a9bc"
  };
  const app = resolve(dir, "src/app.tsx"),
    appProgram = parseProgram(readFileSync(app, "utf8"), app);
  for (const [name, expected] of Object.entries(shapes)) {
    const binding = (name === "Home" || name === "DocPage" ? appProgram : program).scope.getBinding(
      name
    );
    if (!binding || createHash("sha256").update(binding.path.toString()).digest("hex") !== expected)
      throw new Error(
        `C3 docs lowering refuses changed ${name} setup/wrapper; re-prove the lowering`
      );
  }
  const modules = new Map(
    readdirSync(resolve(dir, "src"))
      .filter(f => /\.[jt]sx?$/.test(f) && !f.endsWith(".d.ts"))
      .map(f => [resolve(dir, "src", f), readFileSync(resolve(dir, "src", f), "utf8")])
  );
  const facts = analyzeRecomputable(modules, {
    entry: resolve(dir, "src/main.tsx"),
    resolve: (spec, from) =>
      ["", ".tsx", ".ts"]
        .map(ext => resolve(dirname(from), spec + ext))
        .find(id => modules.has(id)) ?? spec
  });
  if (
    facts.captures.length ||
    facts.regions.filter(r => r.component === "ArticleContent").length !== 2 ||
    !facts.regions.some(r => r.component === "ReadingGuide")
  )
    throw new Error(
      "C3 docs lowering requires both article instances and guide to remain server-recomputable"
    );
  let fallback, pending;
  program.scope.getBinding("ArticleContent").path.traverse({
    CallExpression(p) {
      if (!["Errored", "Loading"].includes(p.node.callee.name)) return;
      const value = p
        .get("arguments")[0]
        .get("properties")
        .find(p => p.node.key?.name === "fallback")
        .get("value");
      if (p.node.callee.name === "Errored") fallback = code.slice(value.node.start, value.node.end);
      else pending = code.slice(value.node.start, value.node.end);
    }
  });
  if (!fallback || !pending) throw new Error("C3 requires the authored article boundary pair");
  const serverCode = extractModule(
    code +
      `
import {constant as __constant, raise as __raise, foreign as __foreign} from "solid-yield";
const __Article = component(function* __Article(props) {
 const outcome = yield* $memo(function* () {
  const slug = (yield* props.slug) ?? "overview";
  return yield* attempt(async () => ({value: await getArticle(slug)}), cause => ({failure: new NotFound(cause)}));
 });
 return view(function* () { return <>{yield* Loading({fallback:${pending}, children:function* () {
  return <>{yield* __Resolved(outcome)}</>;
 }})}</>; });
});
function* __Resolved(outcome) {
 const settled = yield* outcome;
 return <>{yield* Errored({catch:[NotFound],fallback:${fallback},children:function* () {
  return <>{yield* (settled.failure ? __raise(settled.failure) : ArticleBody({article:__constant(settled.value)}))}</>;
 }})}</>;
}
export async function routeRegion(slug) {
 "use server";
 if (slug !== undefined && typeof slug !== "string") throw new TypeError("ArticleContent.slug must be serializable string/undefined");
 return props => <main>{__foreign(__Article)({slug})}<props.like $key="route-like" slug={slug ?? "overview"}/></main>;
}
export async function guideRegion() {
 "use server";
 return () => <section class="reading-guide"><h2>Reading guide</h2>{__foreign(__Article)({slug:"widgets"})}</section>;
}
`,
    content,
    ["routeRegion", "guideRegion"]
  );
  const stubCode = `export {configureServerFunctionsClient} from "@solidjs/web/server-functions";
import {Loading} from "solid-js";
import {dynamic} from "@solidjs/web";
import {routeRegion,guideRegion} from ${JSON.stringify(remote)};
export function RouteRegion(props) {
 const Region=dynamic(()=>routeRegion(props.slug));
 return <Loading fallback=""><Region like={props.like}/></Loading>;
}
export function GuideRegion() {
 const Region=dynamic(()=>guideRegion());
 return <Loading fallback=""><Region/></Loading>;
}
`;
  return {
    name: "compiler-yield:server-components",
    enforce: "pre",
    resolveId(id) {
      if (id === remote || id === stub) return id;
    },
    load(id) {
      if (id === remote) return serverCode;
      if (id === stub) return { code: stubCode, map: null };
    },
    transform(source, id, options) {
      if (id === stub && options?.ssr)
        return {
          code: source.replace(
            'export {configureServerFunctionsClient} from "@solidjs/web/server-functions";',
            ""
          ),
          map: null
        };
      if (id === resolve(dir, "src/app.tsx") || id === resolve(dir, "src/__compiler_single.tsx")) {
        const ast = parseProgram(source, id),
          edits = new MagicString(source);
        edits.prepend(`import {RouteRegion as __RouteRegion} from ${JSON.stringify(stub)};\n`);
        for (const statement of ast.get("body")) {
          if (!statement.isImportDeclaration()) continue;
          const spec = statement
            .get("specifiers")
            .find(p => p.node.imported?.name === "ArticleContent");
          if (spec) {
            const rest = statement.node.specifiers
              .filter(p => p !== spec.node)
              .map(p => source.slice(p.start, p.end));
            edits.overwrite(
              statement.node.start,
              statement.node.end,
              `import {${rest.join(",")}} from ${JSON.stringify(statement.node.source.value)};`
            );
          }
        }
        for (const name of ["Home", "DocPage"]) {
          const binding = ast.scope.getBinding(name);
          if (!binding) throw new Error("C3 missing route component: " + name);
          binding.path.traverse({
            JSXElement(p) {
              if (p.node.openingElement.name.name !== "main") return;
              const slug = name === "Home" ? '"overview"' : "yield* props.params.slug";
              edits.overwrite(
                p.node.start,
                p.node.end,
                `<__RouteRegion slug={${slug}} like={foreign(LikeButton)}/>`
              );
              p.skip();
            }
          });
        }
        return {
          code: edits.toString(),
          map: edits.generateMap({ source: id, includeContent: true, hires: true })
        };
      }
      if (id === resolve(dir, "src/api__compiler_dep.ts")) {
        // Eager's initial dependency graph predates the R cut. Remove the old
        // article export as well, so development modules cannot ship its body.
        const ast = parseProgram(source, id);
        const names = ast
          .get("body")
          .filter(p => p.isExportNamedDeclaration())
          .flatMap(p => p.node.specifiers.map(s => s.exported.name))
          .filter(n => n !== "getArticle");
        return extractModule(source, id, names);
      }
      if (id === content || id === content.replace(".tsx", "__compiler_dep.tsx")) {
        // The App no longer calls ArticleContent; only the guide is reachable
        // in the client content slice. Extraction removes the article imports.
        const ast = parseProgram(source, id),
          binding = ast.scope.getBinding("ReadingGuide");
        if (!binding) return;
        const edits = new MagicString(source);
        edits.prepend(`import {GuideRegion as __GuideRegion} from ${JSON.stringify(stub)};\n`);
        const init = binding.path.get("init");
        edits.overwrite(
          init.node.start,
          init.node.end,
          "component(function* ReadingGuide(){return view(function*(){return <__GuideRegion/>;});})"
        );
        const names = id === content ? ["SiteNav", "SiteFooter", "ReadingGuide"] : ["ReadingGuide"];
        return extractModule(edits.toString(), id, names);
      }
      if (id === resolve(dir, "stream/entry-server.tsx") && options?.ssr) {
        return {
          code:
            source
              .replace("export function render(url: string)", "function __render(url: string)")
              .replace("{ manifest }", "{ manifest, plugins:[ServerComponentPlugin] }") +
            `
import {ServerComponentPlugin,frameTransformDirectResult} from "@solidjs/web/frames";
import {configureServerFunctionsServer} from "@solidjs/web/server-functions";
configureServerFunctionsServer({transformDirectResult:frameTransformDirectResult});
import {provideRequestEvent} from "@solidjs/web/storage";
export function render(url){return provideRequestEvent({request:new Request("http://localhost"+url),locals:{}},()=>__render(url));}
`,
          map: null
        };
      }
      if (id === resolve(dir, "src/__compiler_client.tsx")) {
        return {
          code:
            'import {installServerComponents} from "@solidjs/web/frames";\ninstallServerComponents();\n' +
            source,
          map: null
        };
      }
    }
  };
}
