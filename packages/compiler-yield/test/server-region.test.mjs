import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import solidYield from "../../vite-plugin-yield/src/index.js";
import { emitServerRegion } from "../src/server-region.js";

const require = createRequire(new URL("../package.json", import.meta.url));
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
