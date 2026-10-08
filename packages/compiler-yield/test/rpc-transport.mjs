import { gzipSync } from "node:zlib";
import { fork } from "node:child_process";
export async function rpcTransport({ beforeBody } = {}) {
  const child = fork(new URL("./rpc-worker.mjs", import.meta.url), [], {
    stdio: ["ignore", "ignore", "pipe", "ipc"]
  });
  let errors = "",
    next = 0;
  child.stderr.on("data", chunk => (errors += chunk));
  const pending = new Map(),
    payloads = [];
  const ready = await new Promise((resolve, reject) => {
    child.once("message", message =>
      message.ready ? resolve(message) : reject(new Error(JSON.stringify(message)))
    );
    child.once("exit", code => reject(new Error(`RPC worker exited ${code}: ${errors}`)));
  });
  child.on("message", async message => {
    const entry = pending.get(message.id);
    if (!entry) return;
    if (message.error) {
      entry.controller.error(new Error(message.error));
      entry.reject(new Error(message.error));
      pending.delete(message.id);
      return;
    }
    if (message.status) {
      if (beforeBody)
        entry.bodyGate = new Promise(resolve => {
          setTimeout(() => {
            beforeBody();
            resolve();
          }, 30);
        });
      entry.resolve(
        new Response(entry.stream, { status: message.status, headers: message.headers })
      );
    }
    if (entry.bodyGate) await entry.bodyGate;
    if (message.chunk) {
      const bytes = Buffer.from(message.chunk, "base64");
      entry.parts.push(bytes);
      entry.controller.enqueue(bytes);
    }
    if (message.end) {
      entry.controller.close();
      const body = Buffer.concat(entry.parts).toString();
      payloads.push({
        url: entry.url,
        request: entry.body,
        bytes: Buffer.byteLength(body),
        gzipBytes: gzipSync(body).length,
        body
      });
      pending.delete(message.id);
    }
  });
  return {
    payloads,
    jsonComparison: ready.jsonComparison,
    fetch: async (address, init) => {
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
        pending.set(id, { url, body, stream, controller, resolve, reject, parts: [] });
        child.send({
          id,
          url,
          init: {
            method: init?.method,
            body,
            headers: {
              ...Object.fromEntries(new Headers(init?.headers)),
              origin: "http://localhost"
            }
          }
        });
      });
    },
    close() {
      child.disconnect();
    }
  };
}
