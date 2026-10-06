import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { analyzeInstances } from "./placement.js";
import { extractModule } from "./emit.js";
import { parseProgram } from "../../vite-plugin-yield/src/transform.js";
const require = createRequire(new URL("../../vite-plugin-yield/package.json", import.meta.url));
const MagicString = require("magic-string");

/** Experimental tier-1 emitter for a document shell whose direct children are
 * named component calls or a foreign router. Foreign lifetime and rejected
 * captures widen to the whole direct child. Nested slots are not extracted.
 */
export default function eagerIslands({
  directory,
  roots: rootMode = "per-group",
  onPlan = () => {}
}) {
  if (!["single", "per-group"].includes(rootMode))
    throw new Error("Unknown eager roots mode: " + rootMode);
  const dir = resolve(directory),
    app = resolve(dir, "src/app.tsx");
  const virtual = new Map();
  const transforms = new Map();
  let plan;
  class ClientWide extends Error {
    constructor(at, variable, reason) {
      super(reason);
      this.diagnostic = {
        at,
        variable,
        reason,
        fallback: "whole App uses the unchanged library entry"
      };
    }
  }
  const decline = (at, variable, reason) => {
    throw new ClientWide(at, variable, reason);
  };
  const helper = resolve(dir, "src/__compiler_server.tsx");
  const client = resolve(dir, "src/__compiler_client.tsx");
  function prepare() {
    if (plan) return;
    const modules = new Map(
      readdirSync(resolve(dir, "src"))
        .filter(f => /\.[jt]sx?$/.test(f) && !f.endsWith(".d.ts"))
        .map(f => {
          const id = resolve(dir, "src", f);
          return [id, readFileSync(id, "utf8")];
        })
    );
    const report = analyzeInstances(modules, {
      entry: resolve(dir, "src/main.tsx"),
      resolve: (spec, from) =>
        ["", ".tsx", ".ts"]
          .map(ext => resolve(dirname(from), spec + ext))
          .find(id => modules.has(id)) ?? spec
    });
    const code = modules.get(app),
      ast = parseProgram(code, app);
    // Preserve the authored browser entry's inputs. In this prototype it must
    // call App({}); the server's url is a request hint, not a browser input.
    let emptyClientProps = false;
    parseProgram(modules.get(resolve(dir, "src/main.tsx")), resolve(dir, "src/main.tsx")).traverse({
      CallExpression(p) {
        if (
          p.get("callee").isIdentifier({ name: "App" }) &&
          p.node.arguments.length === 1 &&
          p.get("arguments")[0].isObjectExpression() &&
          !p.node.arguments[0].properties.length
        )
          emptyClientProps = true;
      }
    });
    if (!emptyClientProps)
      decline(
        resolve(dir, "src/main.tsx"),
        "App",
        "tier 1 requires a statically empty browser App input"
      );
    const appBinding = ast.scope.getBinding("App");
    if (!appBinding) decline(app, "App", "tier 1 requires a named App shell");
    const roots = [],
      inert = [],
      diagnostics = [];
    const dependencies = new Map();
    const extract = (filename, names, source = modules.get(filename)) =>
      extractModule(source, filename, names, (spec, imported) => {
        if (!spec.startsWith(".") || imported.some(n => n === "default" || n === "*")) return spec;
        const source = ["", ".tsx", ".ts"]
          .map(ext => resolve(dirname(filename), spec + ext))
          .find(id => modules.has(id));
        if (!source) return spec;
        let dependency = dependencies.get(source);
        if (!dependency)
          dependencies.set(
            source,
            (dependency = {
              names: new Set(),
              module: source.replace(/(\.[jt]sx?)$/, "__compiler_dep$1")
            })
          );
        imported.forEach(name => dependency.names.add(name));
        return dependency.module;
      });
    const at = p => `${app}:${p.node.loc.start.line}:${p.node.loc.start.column + 1}`;
    appBinding.path.traverse({
      YieldExpression(p) {
        const call = p.get("argument");
        if (!call.isCallExpression() || !call.get("callee").isIdentifier()) return;
        const frame = report.components.find(c => c.call === at(call));
        if (!frame) return;
        if (!report.roots.some(r => r.instances.some(id => id.startsWith(frame.instance)))) {
          inert.push({ path: p, name: call.node.callee.name, id: `ci${inert.length + 1}-` });
          return;
        }
        const binding = call.scope.getBinding(call.node.callee.name);
        if (!binding?.path.isImportSpecifier())
          decline(at(call), call.node.callee.name, "unsupported local root");
        const spec = binding.path.parentPath.node.source.value;
        const filename = [".tsx", ".ts"]
          .map(ext => resolve(dirname(app), spec + ext))
          .find(id => modules.has(id));
        const name = binding.path.node.imported.name;
        const inputs = call.get("arguments")[0];
        if (inputs && (!inputs.isObjectExpression() || inputs.node.properties.length))
          decline(
            at(inputs),
            inputs.isIdentifier() ? inputs.node.name : inputs.toString(),
            "root input is not a proved settled serializable constant"
          );
        roots.push({
          path: p,
          filename,
          name,
          groups: report.roots
            .filter(r => r.instances.some(id => id.startsWith(frame.instance)))
            .map(r => r.id),
          inputs: "{}"
        });
      },
      JSXElement(p) {
        const tag = p.get("openingElement.name");
        if (!tag.isJSXIdentifier() || !/^[A-Z]/.test(tag.node.name)) return;
        if (tag.node.name !== "Router")
          decline(at(tag), tag.node.name, "unsupported foreign shell child");
        const container = p.parentPath;
        if (
          !container.isJSXElement() ||
          container.node.children.some(
            child => child !== p.node && !(child.type === "JSXText" && !child.value.trim())
          )
        )
          decline(
            at(tag),
            tag.node.name,
            "reactive foreign root needs an existing sole-child container"
          );
        roots.push({
          path: p,
          filename: app,
          name: "Router",
          foreign: true,
          inputs: "{url: yield* props.url}",
          groups: report.roots
            .filter(r => r.parts.some(x => x.kind === "foreign") || r.foreignAncestors.length)
            .map(r => r.id)
        });
      }
    });
    if (roots.length <= 1)
      decline(app, "App", "zero or one physical root: keep the byte-identical library path");
    const placed = new Set();
    for (const root of roots)
      for (const group of root.groups) {
        if (placed.has(group))
          decline(at(root.path), root.name, "one dependency group reaches multiple shell children");
        placed.add(group);
      }
    if (placed.size !== report.roots.length)
      decline(app, "App", "not all dependency groups have a proved physical placement");
    for (const failure of report.captureFailures)
      diagnostics.push({
        ...failure,
        fallback: "keep the defining foreign route subtree client-wide"
      });
    for (const root of roots) {
      if (root.foreign)
        diagnostics.push({
          at: at(root.path),
          variable: root.name,
          reason: "foreign route lifetime is retained by its whole subtree",
          fallback: "client-wide foreign subtree"
        });
      for (const group of report.roots.filter(
        r => root.groups.includes(r.id) && r.parts.some(p => p.at.includes("/content.tsx:"))
      ))
        for (const part of group.parts)
          if (/\berr\(\)/.test(part.expression))
            diagnostics.push({
              at: part.at,
              variable: "err",
              reason:
                "setup-local error accessor is a function; its failure class cannot cross the codec",
              fallback: `client-wide ${root.name} subtree`
            });
    }
    roots.sort((a, b) => a.path.node.start - b.path.node.start);
    if (rootMode === "single") {
      const exported = ast
        .get("body")
        .find(
          p => p.isExportDefaultDeclaration() && p.get("declaration").isIdentifier({ name: "App" })
        );
      if (!exported) decline(app, "App", "single root requires App as the default export");
      prepareSingle({
        code,
        exported: exported.node,
        roots,
        inert,
        report,
        diagnostics,
        dependencies,
        extract
      });
      return;
    }
    const edits = new MagicString(code);
    edits.prepend(
      `import { Island as __CompilerIsland, Inert as __CompilerInert } from ${JSON.stringify(helper)};\n`
    );
    for (const region of inert)
      edits.overwrite(
        region.path.node.start,
        region.path.node.end,
        `<__CompilerInert id=${JSON.stringify(region.id)} component={${region.name}} />`
      );
    roots.forEach((root, i) => {
      root.id = `cy${i + 1}-`;
      root.module = resolve(dirname(root.filename), `__compiler_${root.name}.tsx`);
      const result = extract(root.filename, [root.name]);
      if (root.foreign) {
        result.code +=
          "\nexport const Root = component(function*(props){return view(function*(){return <Router url={yield* props.url}/>;});});\n";
      }
      virtual.set(root.module, result);
      const value = root.foreign ? `__CompilerRouterRoot` : root.path.node.argument.callee.name;
      if (root.foreign)
        edits.prepend(
          `import {Root as __CompilerRouterRoot} from ${JSON.stringify(root.module)};\n`
        );
      const replacement = `<__CompilerIsland id=${JSON.stringify(root.id)} component={${value}} inputs={${root.inputs}} clientInputs={{}} />`;
      edits.overwrite(root.path.node.start, root.path.node.end, replacement);
    });
    // Imported slices use one canonical module per source, preserving shared class
    // identity. Iterate until transitive export sets stop growing.
    let previous;
    do {
      previous = [...dependencies].map(([id, d]) => id + [...d.names].sort().join(",")).join(";");
      for (const [filename, dependency] of dependencies)
        virtual.set(dependency.module, extract(filename, [...dependency.names]));
    } while (
      previous !== [...dependencies].map(([id, d]) => id + [...d.names].sort().join(",")).join(";")
    );
    // JSX yield expressions became JSX elements inside the original {...} hole.
    virtual.set(app, {
      code: edits.toString(),
      map: edits.generateMap({ source: app, includeContent: true, hires: true })
    });
    virtual.set(helper, {
      code: `import {Hydration} from "solid-js";
import {foreign} from "solid-yield";
import {serializeJSON,createJSONDeserializer} from "@solidjs/web/serialization";
import {capture} from ${JSON.stringify(resolve(import.meta.dirname, "capture.js"))};
export function Island(props){
 const edge=capture(props.clientInputs,{serializeJSON,createJSONDeserializer},props.id);
 if(!edge.ok)throw new Error(edge.at+": "+edge.reason);
 const json=JSON.stringify(edge.node).replaceAll("<","\\\\u003c");
 const Child=foreign(props.component);
 return <><script type="application/json" data-cy={props.id} innerHTML={json}/><Hydration id={props.id}>{Child(props.inputs)}</Hydration></>;
}
export function Inert(props){
 const Child=foreign(props.component);
 return <><script type="application/json" data-ci={props.id}/>{Child({})}<script type="application/json" data-ci-end={props.id}/></>;
}`,
      map: null
    });
    virtual.set(client, {
      code: `${roots.map((r, i) => `import {${r.foreign ? "Root" : r.name} as Root${i}} from ${JSON.stringify(r.module)};`).join("\n")}
import {hydrate} from "solid-yield";
import {createRoot,getOwner,runWithOwner,onCleanup} from "solid-js";
import {claimElementTree} from "@solidjs/web";
import {createJSONDeserializer} from "@solidjs/web/serialization/decode";
import ${JSON.stringify(resolve(dir, "src/app.css"))};
const roots=[${roots.map((r, i) => `[${JSON.stringify(r.id)},Root${i},${!!r.foreign}]`).join(",")}];
export const disposers=[];
const modules=new Map(roots.map(([id,Root,container])=>[id,{Root,container}]));
for(const record of document.querySelectorAll('script[data-cy],script[data-ci]')){
 const id=record.getAttribute('data-cy');
 if(!id){
  const endRecord=document.querySelector('script[data-ci-end="'+record.getAttribute('data-ci')+'"]');
  if(!endRecord)throw new Error('Missing inert range end');
  const start=document.createComment('inert'),end=document.createComment('/inert'),parent=record.parentNode;
  record.replaceWith(start);endRecord.replaceWith(end);
  createRoot(dispose=>{
   disposers.push(dispose);
   const owner=getOwner();
   for(let node=start.nextSibling;node&&node!==end;node=node.nextSibling)claimElementTree(node);
   const observer=new MutationObserver(records=>runWithOwner(owner,()=>{
    for(const change of records)for(const node of change.addedNodes){
     let top=node;while(top&&top.parentNode!==parent)top=top.parentNode;
     for(let child=start.nextSibling;child&&child!==end;child=child.nextSibling)
      if(child===top){claimElementTree(node);break;}
    }
   }));
   observer.observe(parent,{childList:true,subtree:true});
   onCleanup(()=>observer.disconnect());
  });
  continue;
 }
 const {Root,container}=modules.get(id);
 const target=container?record.parentElement:document;
 const inputs=createJSONDeserializer()(JSON.parse(record.textContent));
 record.remove();
 disposers.push(hydrate(()=>Root(inputs),target,{renderId:id}));
}
`,
      map: null
    });
    plan = {
      report,
      diagnostics,
      roots: roots.map(({ path, ...root }) => ({ ...root, at: at(path), hydration: "synchronous" }))
    };
    onPlan(plan);
  }
  function prepareSingle({
    code,
    exported,
    roots,
    inert,
    report,
    diagnostics,
    dependencies,
    extract
  }) {
    const single = resolve(dir, "src/__compiler_single.tsx");
    const slots = resolve(dir, "src/__compiler_slots.tsx");
    const server = new MagicString(code),
      browser = new MagicString(code);
    server.prepend(
      `import {Island as __CompilerIsland, Inert as __CompilerInert} from ${JSON.stringify(helper)};\n`
    );
    browser.prepend(`import {Inert as __CompilerInert} from ${JSON.stringify(slots)};\n`);
    for (const region of inert) {
      server.overwrite(
        region.path.node.start,
        region.path.node.end,
        `<__CompilerInert id=${JSON.stringify(region.id)} component={${region.name}} />`
      );
      browser.overwrite(
        region.path.node.start,
        region.path.node.end,
        `<__CompilerInert id=${JSON.stringify(region.id)} />`
      );
    }
    // Both sides create the same App owner and slot owners. Only server slots
    // reference inert component bodies; extraction removes those client imports.
    server.overwrite(
      exported.start,
      exported.end,
      'export default function Single(props){return <__CompilerIsland id="cs-" component={App} inputs={props} clientInputs={{}}/>;}'
    );
    virtual.set(app, {
      code: server.toString(),
      map: server.generateMap({ source: app, includeContent: true, hires: true })
    });
    // Keep edits and extraction as separate Vite map stages, so generated slot
    // imports do not shift authored stack frames in the client root.
    const sliced = extract(app, ["App"], browser.toString());
    virtual.set(single, {
      code: browser.toString(),
      map: browser.generateMap({ source: app, includeContent: true, hires: true })
    });
    transforms.set(single, sliced);
    let previous;
    do {
      previous = [...dependencies].map(([id, d]) => id + [...d.names].sort().join(",")).join(";");
      for (const [filename, dependency] of dependencies)
        virtual.set(dependency.module, extract(filename, [...dependency.names]));
    } while (
      previous !== [...dependencies].map(([id, d]) => id + [...d.names].sort().join(",")).join(";")
    );
    virtual.set(helper, {
      code: `import {Hydration,NoHydration} from "solid-js";
import {foreign} from "solid-yield";
import {serializeJSON,createJSONDeserializer} from "@solidjs/web/serialization";
import {capture} from ${JSON.stringify(resolve(import.meta.dirname, "capture.js"))};
export function Island(props){
 const edge=capture(props.clientInputs,{serializeJSON,createJSONDeserializer},props.id);
 if(!edge.ok)throw new Error(edge.at+": "+edge.reason);
 const json=JSON.stringify(edge.node).replaceAll("<","\\\\u003c");
 const Child=foreign(props.component);
 return <><script type="application/json" data-cy={props.id} innerHTML={json}/><Hydration id={props.id}>{Child(props.inputs)}</Hydration></>;
}
export function Inert(props){
 const Child=foreign(props.component);
 return <NoHydration><script type="application/json" data-ci={props.id}/>{Child({})}<script type="application/json" data-ci-end={props.id}/></NoHydration>;
}`,
      map: null
    });
    virtual.set(slots, {
      code: `import {NoHydration,getOwner,runWithOwner,onCleanup} from "solid-js";
import {claimElementTree} from "@solidjs/web";
export function Inert(props){
 NoHydration({});
 const record=document.querySelector('script[data-ci="'+props.id+'"]');
 const endRecord=document.querySelector('script[data-ci-end="'+props.id+'"]');
 if(!record||!endRecord)throw new Error('Missing inert range');
 const start=document.createComment('inert'),end=document.createComment('/inert'),parent=record.parentNode;
 record.replaceWith(start);endRecord.replaceWith(end);
 const owner=getOwner();
 for(let node=start.nextSibling;node&&node!==end;node=node.nextSibling)claimElementTree(node);
 const observer=new MutationObserver(records=>runWithOwner(owner,()=>{
  for(const change of records)for(const node of change.addedNodes){
   let top=node;while(top&&top.parentNode!==parent)top=top.parentNode;
   for(let child=start.nextSibling;child&&child!==end;child=child.nextSibling)
    if(child===top){claimElementTree(node);break;}
  }
 }));
 observer.observe(parent,{childList:true,subtree:true});
 onCleanup(()=>observer.disconnect());
}`,
      map: null
    });
    virtual.set(client, {
      code: `import {App} from ${JSON.stringify(single)};
import {hydrate} from "solid-yield";
import {createJSONDeserializer} from "@solidjs/web/serialization/decode";
const record=document.querySelector('script[data-cy="cs-"]');
const inputs=createJSONDeserializer()(JSON.parse(record.textContent));
record.remove();
export const disposers=[hydrate(()=>App(inputs),document,{renderId:"cs-"})];
`,
      map: null
    });
    plan = {
      report,
      diagnostics,
      mode: "single",
      roots: [
        {
          id: "cs-",
          module: single,
          groups: roots.flatMap(r => r.groups),
          hydration: "synchronous"
        }
      ]
    };
    onPlan(plan);
  }
  const checkedPrepare = () => {
    if (plan) return;
    try {
      prepare();
    } catch (error) {
      if (!(error instanceof ClientWide)) throw error;
      virtual.clear();
      transforms.clear();
      plan = { roots: [], fallback: true, diagnostics: [error.diagnostic] };
      onPlan(plan);
    }
  };
  return {
    name: "compiler-yield:eager-islands",
    enforce: "pre",
    config() {
      if (rootMode === "single") return {};
      return {
        build: {
          rollupOptions: {
            output: {
              onlyExplicitManualChunks: true,
              manualChunks(id) {
                const name = /\/__compiler_(?!client|server)([A-Z][A-Za-z]+)\.tsx$/.exec(id)?.[1];
                return name ? `island-${name}` : undefined;
              }
            }
          }
        }
      };
    },
    buildStart() {
      checkedPrepare();
    },
    resolveId(id) {
      checkedPrepare();
      if (virtual.has(id) && id !== app) return id;
    },
    load(id) {
      checkedPrepare();
      if (virtual.has(id) && id !== app) return { ...virtual.get(id) };
    },
    transform(code, id, options) {
      checkedPrepare();
      if (plan.fallback) return null;
      if (transforms.has(id)) return { ...transforms.get(id) };
      if (id === app && options?.ssr) return { ...virtual.get(app) };
      if (id === resolve(dir, "stream/client.tsx") || id === resolve(dir, "src/main.tsx"))
        if (!options?.ssr)
          return { code: `export {disposers} from ${JSON.stringify(client)};`, map: null };
      if (id === resolve(dir, "src/shell.tsx") && options?.ssr) {
        const s = new MagicString(code);
        s.prepend('import {NoHydration} from "solid-js";\n');
        s.appendLeft(code.indexOf("<html"), "<NoHydration>");
        s.appendLeft(code.indexOf("</html>") + 7, "</NoHydration>");
        return {
          code: s.toString(),
          map: s.generateMap({ source: id, includeContent: true, hires: true })
        };
      }
      return null;
    }
  };
}
