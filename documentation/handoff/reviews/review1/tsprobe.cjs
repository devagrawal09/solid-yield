const { spawn } = require("node:child_process");
const path = require("node:path");
const app = "/private/tmp/sy-review-out/myapp";
const file = process.argv[2] || path.join(app, "src/index.tsx");
const p = spawn(process.execPath, [path.join(app, "node_modules/typescript/lib/tsserver.js")], { cwd: app });
let seq = 0, buf = "", pend = new Map();
p.stdout.on("data", d => { buf += d; let m; while ((m = buf.match(/Content-Length: (\d+)\r?\n\r?\n/))) { const s = m.index + m[0].length, n = +m[1]; if (buf.length < s + n) break; const msg = JSON.parse(buf.slice(s, s + n)); buf = buf.slice(s + n); if (msg.type === "response" && pend.has(msg.request_seq)) pend.get(msg.request_seq)(msg); } });
const req = (command, args) => new Promise(r => { const id = ++seq; pend.set(id, r); p.stdin.write(JSON.stringify({ seq: id, type: "request", command, arguments: args }) + "\n"); });
(async () => {
  await req("open", { file, projectRootPath: app });
  const d = await req("semanticDiagnosticsSync", { file });
  console.log("diagnostics:", JSON.stringify((d.body || []).map(x => [x.start.line + ":" + x.start.offset, x.code, String(x.text).slice(0, 160)])));
  const q = await req("quickinfo", { file: path.join(app, "src/App.tsx"), line: 22, offset: 18 }).catch(() => null);
  const a = await req("open", { file: path.join(app, "src/App.tsx") });
  const q2 = await req("quickinfo", { file: path.join(app, "src/App.tsx"), line: 22, offset: 18 });
  console.log("hover App:", q2.body && q2.body.displayString);
  p.kill();
})();
