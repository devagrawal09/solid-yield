import { fork } from "node:child_process";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { populateGlobal } from "vitest/runtime";
import { makeServer } from "./config.mjs";
const mode = process.argv[2],
  inner = process.argv[3] === "inner";
const child = fork(new URL("./worker.mjs", import.meta.url), [], {
  env: { ...process.env, MODE: mode },
  stdio: ["ignore", "ignore", "inherit", "ipc"]
});
const ready = await new Promise((resolve, reject) => {
  child.once("message", resolve);
  child.once("exit", code => reject(new Error("worker " + code)));
});
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost/page/a",
  pretendToBeVisual: true
});
populateGlobal(globalThis, dom.window, { bindFunctions: true });
window.scrollTo = () => {};
HTMLElement.prototype.scrollIntoView = () => {};
const scripts = [];
document.body.innerHTML = ready.html.replace(
  /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
  (all, attrs, body) => {
    if (!/\bsrc=/.test(attrs)) scripts.push(body);
    return "";
  }
);
for (const script of scripts) (0, eval)(script);
const trace = [],
  out = { mode };
const tick = () => new Promise(r => setTimeout(r, 10));
async function until(fn) {
  for (let n = 0; n < 200; n++) {
    if (fn()) return;
    await tick();
  }
  throw new Error("timeout " + document.body.innerHTML);
}
const outDummy = () => trace.some(x => x.event === "frame-applied");
const source = () => ({
  url: location.pathname + location.hash,
  content: document.querySelector("article")?.getAttribute("data-page") ?? null,
  raw: [...document.querySelectorAll(".raw a")].map(a => a.outerHTML),
  part: document.querySelector(".part")?.outerHTML ?? null,
  authored: document.querySelector(".authored")?.outerHTML ?? null
});
const before = document.querySelector("article");
const requests = new Map();
let next = 0,
  hold = false,
  heldId,
  headersId;
child.on("message", msg => {
  if (msg.headersHeld) {
    headersId = msg.headersHeld;
    trace.push({ event: "headers-held", ...source() });
    return;
  }
  if (msg.held) {
    heldId = msg.held;
    trace.push({ event: "request-held", ...source() });
    return;
  }
  const entry = requests.get(msg.id);
  if (!entry) return;
  if (msg.error) entry.reject(new Error(msg.error));
  if (msg.status)
    entry.resolve(new Response(entry.stream, { status: msg.status, headers: msg.headers }));
  if (msg.chunk) {
    trace.push({ event: "frame-chunk", ...source() });
    entry.controller.enqueue(Buffer.from(msg.chunk, "base64"));
  }
  if (msg.end) {
    entry.controller.close();
    requests.delete(msg.id);
  }
});
globalThis.fetch = async (address, init) => {
  const id = ++next,
    url = new URL(address, "http://localhost").href;
  let controller;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    }
  });
  const body =
    init?.body == null
      ? undefined
      : typeof init.body === "string"
        ? init.body
        : await new Response(init.body).text();
  return new Promise((resolve, reject) => {
    requests.set(id, { controller, stream, resolve, reject });
    child.send({
      id,
      url,
      hold,
      inner,
      init: {
        method: init?.method,
        body,
        headers: { ...Object.fromEntries(new Headers(init?.headers)), origin: "http://localhost" }
      }
    });
  });
};
const server = await makeServer(mode, true);
const web = await server.environments.hydrate.runner.import("@solidjs/web");
const unregister = web.registerElementClaim(node => {
  if (node.nodeName === "A")
    trace.push({
      event: "claim",
      href: node.getAttribute("href"),
      base: document.baseURI,
      ...source()
    });
});
const push = history.pushState.bind(history);
history.pushState = (state, title, url) => {
  trace.push({ event: "before-push", target: String(url), ...source() });
  push(state, title, url);
  trace.push({ event: "after-push", ...source() });
};
document.addEventListener("frame:applied", () =>
  trace.push({ event: "frame-applied", ...source() })
);
out.ssr = source();
const client = await server.environments.hydrate.runner.import("/client.tsx");
await tick();
if (mode === "ordinary") {
  const { RawLinks } = await server.environments.hydrate.runner.import("/raw-links.tsx");
  const root = document.createElement("div");
  document.body.append(root);
  const disposeRaw = web.render(RawLinks, root);
  const anchors = () => [...root.querySelectorAll("a")].map(a => a.outerHTML);
  const before = anchors();
  root.querySelector("button").click();
  out.attach = { before, after: anchors() };
  assert(!out.attach.after[0].includes("data-active"));
  assert(out.attach.after[2].includes('aria-current="page"'));
  disposeRaw();
  root.remove();
}
out.hydrated = source();
out.retainedSSR = before === document.querySelector("article");
assert(out.retainedSSR, "hydration retains article");
trace.length = 0;
let release;
if (mode === "ordinary") globalThis.holdData = new Promise(r => (release = r));
else hold = true;
const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
document.querySelector('.raw a[href="/page/b"]').dispatchEvent(event);
out.intercepted = event.defaultPrevented;
await until(() => mode === "ordinary" || heldId);
await tick();
out.pending = source();
if (mode === "ordinary") {
  release();
  globalThis.holdData = undefined;
} else {
  hold = false;
  child.send({ release: heldId });
  if (inner) {
    await until(() => outDummy());
    await tick();
    out.innerPending = source();
    child.send({ releaseContent: true });
  } else {
    await until(() => headersId);
    await tick();
    out.headersBeforeBody = source();
    child.send({ releaseBody: headersId });
  }
}
await until(() => source().content === "b" && location.pathname === "/page/b");
await tick();
out.settled = source();
out.trace = trace.splice(0);
const hash = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
document.querySelector(".part").dispatchEvent(hash);
await until(() => location.hash === "#part");
await tick();
out.afterHash = source();
writeFileSync(
  new URL(`./${mode}${inner ? "-inner" : ""}.json`, import.meta.url),
  JSON.stringify(out, null, 2) + "\n"
);
assert(out.intercepted, "raw HTML route link is intercepted");
assert(
  out.pending.url === "/page/a" && out.pending.content === "a",
  "previous page while fetch is held"
);
if (mode === "ordinary")
  assert(
    out.hydrated.raw.every(x => !x.includes("data-active") && !x.includes("aria-current")),
    "raw HTML stays unclaimed"
  );
else assert(out.hydrated.raw[0].includes('aria-current="page"'), "frame adoption claims raw HTML");
if (!inner && mode !== "ordinary")
  assert.equal(
    out.headersBeforeBody.url,
    mode === "hosted" ? "/page/b" : "/page/a",
    "headers versus applied HTML"
  );
if (inner && mode !== "ordinary") {
  assert.equal(out.innerPending.url, "/page/b");
  assert.equal(out.innerPending.content, null);
}
assert(
  out.settled.part && out.settled.part.includes("aria-current") === inner,
  "root claims use the old URL; later streamed segment claims use the committed URL"
);
assert(
  out.afterHash.part.includes('aria-current="page"'),
  "hash navigation refreshes fragment state"
);
console.log(
  JSON.stringify({
    mode,
    intercepted: out.intercepted,
    headersBeforeBody: out.headersBeforeBody,
    innerPending: out.innerPending,
    order: out.trace
      .filter(x => ["before-push", "frame-applied", "headers-held"].includes(x.event))
      .map(x => [x.event, x.url, x.content])
  })
);
unregister();
client.dispose();
await server.close();
child.disconnect();
dom.window.close();
process.exit();
