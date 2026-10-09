// node nav-check.mjs <reused|keyed|dynamic>
// Client render at /page/a, click a link to /page/b with the async work held,
// and record URL + DOM at each phase.
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/runtime";
import { makeServer } from "./config.mjs";

const variant = process.argv[2];
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost/page/a",
  pretendToBeVisual: true
});
populateGlobal(globalThis, dom.window, { bindFunctions: true });
window.scrollTo = () => {};
HTMLElement.prototype.scrollIntoView = () => {};

const tick = () => new Promise(r => setTimeout(r, 20));
const settle = async () => {
  for (let i = 0; i < 5; i++) await tick();
};
const snap = label => ({
  phase: label,
  url: location.pathname,
  article: document.querySelector("article")?.getAttribute("data-page") ?? null,
  outerFallback: !!document.querySelector("p.outer"),
  innerFallback: !!document.querySelector("p.inner")
});
const hold = name => {
  let release;
  globalThis[name] = new Promise(r => (release = r));
  return () => {
    globalThis[name] = undefined;
    release();
  };
};

const server = await makeServer("client-nav", true);
const web = await server.environments.hydrate.runner.import("@solidjs/web");
const { makeApp } = await server.environments.hydrate.runner.import("/nav-client.tsx");
const root = document.createElement("div");
document.body.append(root);
const dispose = web.render(makeApp(variant), root);
await settle();
const out = [snap("initial /page/a")];

const releaseModule = variant === "dynamic" ? hold("holdModule") : null;
const releaseData = hold("holdData");
const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
document.querySelector("a.to-b").dispatchEvent(click);
await settle();
out.push(snap(releaseModule ? "clicked; module + data held" : "clicked; data held"));
if (releaseModule) {
  releaseModule();
  await settle();
  out.push(snap("module released; data held"));
}
releaseData();
await settle();
out.push(snap("all released"));

console.log(`== ${variant} (intercepted: ${click.defaultPrevented})`);
for (const s of out)
  console.log(
    `  ${s.phase.padEnd(30)} url=${s.url}  article=${s.article}  outer=${s.outerFallback}  inner=${s.innerFallback}`
  );
dispose();
await server.close();
dom.window.close();
process.exit();
