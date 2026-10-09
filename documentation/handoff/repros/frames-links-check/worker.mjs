import { makeServer } from "./config.mjs";
const server = await makeServer(process.env.MODE);
const entry = await server.ssrLoadModule("/server.tsx");
const html = String(await entry.render("/page/a"));
const handler = await server.ssrLoadModule("virtual:solid-server-function-handler");
const held = new Map(),
  bodyGates = new Map();
async function respond(msg) {
  try {
    if (msg.inner)
      globalThis.holdContent = new Promise(resolve => bodyGates.set("content", resolve));
    const response = await handler.handleServerFunctionRequest(new Request(msg.url, msg.init));
    process.send({
      id: msg.id,
      status: response.status,
      headers: Object.fromEntries(response.headers)
    });
    if (msg.hold && !msg.inner)
      await new Promise(resolve => {
        bodyGates.set(msg.id, resolve);
        process.send({ headersHeld: msg.id });
      });
    if (response.body)
      for await (const chunk of response.body)
        process.send({ id: msg.id, chunk: Buffer.from(chunk).toString("base64") });
    process.send({ id: msg.id, end: true });
  } catch (error) {
    process.send({ id: msg.id, error: String(error.stack) });
  }
}
process.on("message", msg => {
  if (msg.releaseContent) {
    bodyGates.get("content")();
    globalThis.holdContent = undefined;
    bodyGates.delete("content");
  } else if (msg.releaseBody) {
    bodyGates.get(msg.releaseBody)();
    bodyGates.delete(msg.releaseBody);
  } else if (msg.release) {
    const request = held.get(msg.release);
    held.delete(msg.release);
    respond(request);
  } else if (msg.hold) {
    held.set(msg.id, msg);
    process.send({ held: msg.id });
  } else respond(msg);
});
process.on("disconnect", async () => {
  await server.close();
  process.exit();
});
process.send({ ready: true, html });
