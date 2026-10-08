import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import solidYield from "../../vite-plugin-yield/src/index.js";
import { emitServerRegion } from "../src/server-region.js";

const require = createRequire(new URL("../package.json", import.meta.url));
test("C4b: existing hosts and wrapper hosts preserve like and copy-code slots across swaps", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--conditions=browser",
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    import {JSDOM} from "jsdom";
    import {createFrame,createFrameHost,createFrameElement} from "@solidjs/web/frames";
    const dom=new JSDOM("<body></body>");
    globalThis.document=dom.window.document;
    for (const hosted of [false,true]) {
      const host=createFrameHost(), fills={}, calls={like:0,copy:0};
      const slots=Object.fromEntries(["like","copy"].map(name=>[name,(args,ctx)=>{
        calls[name]++;
        const button=document.createElement("button");
        let clicks=0;
        button.textContent=name+":0:"+args.text;
        button.onclick=()=>button.textContent=name+":"+(++clicks)+":"+args.text;
        ctx.onUpdate(next=>{args=next;button.textContent=name+":"+clicks+":"+args.text;});
        fills[name]=button;
        return button;
      }]));
      const element=hosted?document.createElement("article"):undefined;
      const pair=hosted?{element,frame:createFrame(element,{id:"r",host,slots})}:createFrameElement({id:"r",host,slots});
      document.body.append(pair.element);
      for (const version of [1,2]) {
        for (const key of ["like","copy"]) host.apply({type:"slot",id:"r",version,key:key+"#stable",args:{text:"v"+version}});
        const keys=version===1?["like","copy"]:["copy","like"];
        host.apply({type:"html",id:"r",version,html:"<h2>v"+version+"</h2>"+keys.map(key=>"<!--slot:"+key+"#stable:start--><!--slot:"+key+"#stable:end-->").join("")});
        if(version===1) for(const key of keys) fills[key].click();
      }
      assert.equal(pair.element.parentNode,document.body);
      assert.equal(pair.element.firstElementChild.textContent,"v2");
      assert.deepEqual(calls,{like:1,copy:1});
      for(const key of ["like","copy"]){
        assert(pair.element.contains(fills[key]));
        assert.equal(fills[key].textContent,key+":1:v2");
        fills[key].click();
        assert.equal(fills[key].textContent,key+":2:v2");
      }
      assert.equal(pair.element.tagName,hosted?"ARTICLE":"SOLID-FRAME");
      pair.frame.dispose();pair.element.remove();
    }
    dom.window.close();
  `
    ],
    { cwd: resolve(import.meta.dirname, ".."), encoding: "utf8", timeout: 10000 }
  );
  assert.equal(child.status, 0, child.stdout + child.stderr);
});
test("C4: the low-level public frame API can reuse an authored element", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--conditions=browser",
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    import {JSDOM} from "jsdom";
    import {createFrame,createFrameHost} from "@solidjs/web/frames";
    const dom=new JSDOM("<main><p>old</p></main>");
    globalThis.document=dom.window.document;
    const main=document.querySelector("main"), host=createFrameHost();
    const frame=createFrame(main,{host,id:"probe",adopt:true});
    host.apply({type:"html",id:"probe",version:1,html:"<p>new</p>"});
    assert.equal(document.querySelector("main"),main);
    assert.equal(document.body.innerHTML,"<main><p>new</p></main>");
    frame.dispose();dom.window.close();
  `
    ],
    { cwd: resolve(import.meta.dirname, ".."), encoding: "utf8", timeout: 10000 }
  );
  assert.equal(child.status, 0, child.stdout + child.stderr);
});
test("D-115: generated article frames preserve the public failure message", async () => {
  const { createServer } = await import(pathToFileURL(require.resolve("vite")));
  const { default: plugin } = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
  const solid = typeof plugin === "function" ? plugin : plugin.default;
  const directory = resolve(import.meta.dirname, "../../../examples/docs-yield");
  const source = resolve(directory, "src/content.tsx");
  const emittedId = resolve(directory, "src/__c3_article_probe.tsx");
  const out = emitServerRegion(readFileSync(source, "utf8"), source, "ArticleContent", ["slug"]);
  assert.match(out.code, /"use server"/);
  assert.match(out.code, /ArticleBody/);
  assert.doesNotMatch(out.code, /Loading navigation|Loading footer|const SiteNav/);
  out.code += `
import {renderServerComponent} from "@solidjs/web/frames";
import {provideRequestEvent} from "@solidjs/web/storage";
import {serializeJSON,createJSONDeserializer} from "@solidjs/web/serialization";
import {capture} from ${JSON.stringify(resolve(import.meta.dirname, "../src/capture.js"))};
export async function probe(slug) {
  const edge=capture([slug],{serializeJSON,createJSONDeserializer},"ArticleContent.slug");
  if(!edge.ok)throw new Error(edge.reason);
  const errors=[];
  const chunks=await provideRequestEvent({request:new Request("http://localhost/"),locals:{}},async()=>
    await renderServerComponent(await __serverRegion(...edge.value),{
      onError:error=>{errors.push({message:error.message,kind:error.kind});}
    }));
  return {chunks,errors};
}
`;
  const vite = await createServer({
    root: directory,
    configFile: false,
    mode: "production",
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [
      {
        name: "c3:frame-probe",
        resolveId: id => (id === emittedId ? id : null),
        load: id => (id === emittedId ? out : null)
      },
      solidYield(),
      solid({ hot: false, ssr: true, serverFunctions: { components: true } })
    ]
  });
  try {
    const generated = await vite.ssrLoadModule(emittedId);
    const success = await generated.probe("start");
    assert.equal(success.errors.length, 0, JSON.stringify(success.errors));
    assert(success.chunks.some(c => c.html?.includes("Getting started")));
    assert(success.chunks.some(c => c.html?.includes("Related reading")));
    const failure = await generated.probe("missing");
    assert(failure.errors.some(e => e.kind === "not-found" && e.message === "No article: missing"));
    if (process.env.C3_FRAME_RECORD)
      writeFileSync(
        process.env.C3_FRAME_RECORD,
        JSON.stringify({ success, failure }, null, 2) + "\n"
      );
    const errors = failure.chunks.filter(c => c.type === "error");
    assert(errors.length > 0);
    assert(errors.every(c => JSON.stringify(c.error).includes("No article: missing")));
    assert(!JSON.stringify(failure.chunks).includes("Internal Server Error"));
    // The frame error protocol carries the message only. C3's region emitter
    // must retain typed handling inside the template rather than rely on this
    // generic frame error as the authored NotFound value.
  } finally {
    await vite.close();
  }
});
