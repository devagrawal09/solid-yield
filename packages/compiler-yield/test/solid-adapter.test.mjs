import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { solidAdapterVersionPlugin, solidAdapterVersions } from "../src/server-components.js";

const directory = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(directory, "package.json"));
const adapter = resolve(directory, "src/solid-adapter.js");
const client = resolve(directory, "src/hosted-region-client.js");
const serverAdapter = resolve(directory, "src/hosted-region-server.js");
const { createServer, createRunnableDevEnvironment } = await import(
  pathToFileURL(require.resolve("vite"))
);
const solidModule = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
const solid =
  typeof solidModule.default === "function" ? solidModule.default : solidModule.default.default;

async function withRuntime(run, versions) {
  const id = resolve(directory, "test/__adapter_contract.tsx");
  const vite = await createServer({
    root: directory,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [
      {
        name: "contract:no-hmr",
        enforce: "pre",
        load(id) {
          if (/\/vite\/dist\/client\/client\.mjs$/.test(id))
            return "export const createHotContext=()=>({data:{},accept(){},acceptExports(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=x=>x;export class ErrorOverlay {}";
        }
      },
      ...(versions
        ? [
            {
              name: "contract:versions",
              enforce: "pre",
              resolveId(id) {
                if (id === "virtual:compiler-yield-solid-versions") return "\0contract:versions";
              },
              load(id) {
                if (id === "\0contract:versions")
                  return `export default ${JSON.stringify(versions)};`;
              }
            }
          ]
        : []),
      solidAdapterVersionPlugin(directory),
      {
        name: "contract:fixture",
        load(source) {
          if (source === id)
            return `
import {createSignal,createMemo} from "solid-js";
function Like(props){const [count,setCount]=createSignal(0);return <button onClick={()=>setCount(n=>n+1)}>{props.slug}:{count()}</button>;}
${
  this.environment.name === "ssr"
    ? `
import {renderToString,HydrationScript} from "@solidjs/web";
import {ServerComponentPlugin,SERVER_COMPONENT_BOOTSTRAP,frameTransformDirectResult} from "@solidjs/web/frames";
import {hostedRegionResult} from ${JSON.stringify(serverAdapter)};
const Fill=props=>createMemo(()=><Like {...props}/>);
const Source=Object.assign(props=><><p>server</p><props.like $key="route-like" slug="start"/></>,{regionRoot:"main"});
const Region=hostedRegionResult(Source,{id:"contract",args:[]});
export function metadata(){const raw=frameTransformDirectResult(Source,{id:"contract",args:[]});return Object.getOwnPropertySymbols(raw).map(key=>[Symbol.keyFor(key),Object.prototype.propertyIsEnumerable.call(raw,key),raw[key]===Region[key]]);}
export function render(){return {bootstrap:SERVER_COMPONENT_BOOTSTRAP,html:renderToString(()=><><Region like={Fill}/><HydrationScript/></>,{plugins:[ServerComponentPlugin]})};}
`
    : `
import {hydrate} from "@solidjs/web";
import {installHostedRegions} from ${JSON.stringify(client)};
import {claimSlot,seedDocumentSlot,clearHostMarker} from ${JSON.stringify(adapter)};
import {sharedConfig} from "solid-js/internal";
import {createFrame,createFrameHost} from "@solidjs/web/frames";
export function checkFrame(){
 const host=createFrameHost(),el=document.createElement("main"),observed=[];
 const frame=createFrame(el,{id:"first",host,onApply(){observed.push(el.textContent);}});
 host.apply({type:"html",id:"first",version:1,html:"<p>first</p>"});
 frame.rebind("second");clearHostMarker(el);
 host.apply({type:"html",id:"second",version:1,html:"<p>second</p>"});
 if(el.textContent!=="second"||observed.at(-1)!=="second"||el.hasAttribute("data-fid"))throw new Error("frame application/rebind contract changed");
 const count=observed.length;frame.dispose();
 host.apply({type:"html",id:"second",version:2,html:"<p>disposed</p>"});
 if(observed.length!==count||el.textContent!=="second")throw new Error("disposed frame still receives updates");
}

export function checkClaims(button){
 const previous={registry:sharedConfig.registry,roots:sharedConfig.claimRoots,hydrating:sharedConfig.hydrating};
 const outer=new Map([[button.getAttribute("_hk"),button]]),roots=[document.body];
 sharedConfig.registry=outer;sharedConfig.claimRoots=roots;sharedConfig.hydrating=true;
 const sentinel=new Error("claim failed");
 try {
  let thrown;
  try{claimSlot("contract",[button],()=>{if(sharedConfig.registry===outer||sharedConfig.claimRoots===roots)throw new Error("slot scope was not entered");throw sentinel;});}catch(error){thrown=error;}
  if(thrown!==sentinel||sharedConfig.registry!==outer||sharedConfig.claimRoots!==roots||outer.has(button.getAttribute("_hk")))throw new Error("slot claim did not restore outer state");
 }finally{sharedConfig.registry=previous.registry;sharedConfig.claimRoots=previous.roots;sharedConfig.hydrating=previous.hydrating;}
}
export function checkMissingRecord(){seedDocumentSlot({apply(){throw new Error("applied invalid record");}},"absent","absent");}

installHostedRegions();
export function attach(){const Region=globalThis._$SC.r("contract");return hydrate(()=><Region like={Like} regionRoot="main"/>,document.body);}
`
}
`;
        }
      },
      solid({ hot: false, ssr: true })
    ],
    server: { middlewareMode: true, hmr: false, ws: false },
    environments: {
      hydrate: {
        consumer: "client",
        resolve: { conditions: ["browser", "development"] },
        optimizeDeps: { noDiscovery: true, include: [] },
        dev: {
          moduleRunnerTransform: true,
          createEnvironment: (name, config) =>
            createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
        }
      }
    }
  });
  try {
    await run(vite, id);
  } finally {
    await vite.close();
  }
}

test("adapter: installed versions and changed versions fail at module load on both sides", async () => {
  await withRuntime(async vite => {
    await vite.ssrLoadModule(adapter);
    await vite.environments.hydrate.runner.import(adapter);
  });
  for (const name of ["solid-js", "@solidjs/web"]) {
    const versions = {
      adapter: solidAdapterVersions(directory),
      application: { ...solidAdapterVersions(directory), [name]: "2.0.0-rc.14" }
    };
    await withRuntime(async vite => {
      for (const load of [
        () => vite.ssrLoadModule(adapter),
        () => vite.environments.hydrate.runner.import(adapter)
      ])
        await assert.rejects(
          load(),
          /compiler-yield's frame adapter was validated against 2\.0\.0-rc\.13; found .*rc\.14.*see documentation\/compiler-adapter\.md/
        );
    }, versions);
  }
});

test("adapter: actual document encoder, slot claim, registry binding, and cleanup", async () => {
  await withRuntime(async (vite, id) => {
    const fixture = await vite.ssrLoadModule(id);
    assert.deepEqual(fixture.metadata(), [
      ["solid.server-component", true, true],
      ["solid.server-component-source", true, true],
      ["solid.server-component-address", true, true]
    ]);
    const { html, bootstrap } = fixture.render();
    assert.match(html, /<main data-fid="contract">/);
    assert.match(html, /<!--slot:like#route-like:start-->/);
    assert.match(html, /sc:slot:contract:like#route-like/);
    assert.match(html, /_hk="?sc-contract-like#route-like-/);
    const { JSDOM } = require("jsdom");
    const { populateGlobal } = await import(pathToFileURL(require.resolve("vitest/runtime")));
    const scripts = [];
    const clean = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (_all, body) => {
      scripts.push(body);
      return "";
    });
    const dom = new JSDOM(`<body>${clean}</body>`, { url: "http://localhost/" });
    const globals = populateGlobal(globalThis, dom.window, { bindFunctions: true });
    try {
      for (const script of [bootstrap, ...scripts]) (0, eval)(script);
      const main = document.querySelector("main"),
        button = document.querySelector("button");
      const module = await vite.environments.hydrate.runner.import(id);
      module.checkFrame();
      module.checkClaims(button);
      assert.throws(() => module.checkMissingRecord(), /completed primitive inputs/);
      const dispose = module.attach();
      assert.equal(document.querySelector("main"), main);
      assert.equal(document.querySelector("button"), button);
      assert.equal(main.hasAttribute("data-fid"), false);
      assert.equal(document.querySelector("solid-frame"), null);
      button.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(button.textContent, "start:1");
      dispose();
    } finally {
      for (const key of globals.keys) delete globalThis[key];
      for (const [key, value] of globals.originals) globalThis[key] = value;
      delete globalThis._$HY;
      delete globalThis._$SC;
      dom.window.close();
    }
  });
});

test("adapter: changed document encoder shape is rejected", async () => {
  await withRuntime(async vite => {
    const { encodeHostedRegion } = await vite.ssrLoadModule(adapter);
    const value = Object.assign(() => undefined, { regionRoot: "main" });
    for (const nodes of [
      [],
      [{ t: '<solid-frame data-fid="r">' }, null, { t: "</solid-frame>" }],
      { t: "changed" }
    ])
      assert.throws(
        () => encodeHostedRegion(value, {}, () => () => nodes)({}),
        /document encoder shape changed/
      );
  });
});
