const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
test(
  "real tsserver loads the plugin, maps diagnostics and hover, and sees unsaved edits",
  { timeout: 60000 },
  async () => {
    const dir = path.join(__dirname, ".native-generated", "protocol-" + process.pid);
    fs.mkdirSync(dir, { recursive: true });
    const source = require("./cases.cjs")[0].source;
    const colors = fs.readFileSync(path.join(__dirname, "fixtures/colors.tsx"), "utf8");
    const file = path.join(dir, "counter.tsx"),
      colorFile = path.join(dir, "colors.tsx");
    fs.writeFileSync(file, source);
    fs.writeFileSync(colorFile, colors);
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "preserve",
          types: [],
          plugins: [{ name: "ts-plugin-solid-yield", mode: "native", include: ["*.tsx"] }]
        },
        include: ["*.tsx"]
      })
    );
    const child = spawn(
      process.execPath,
      [
        require.resolve("typescript/lib/tsserver.js"),
        "--allowLocalPluginLoads",
        "--pluginProbeLocations",
        path.resolve(__dirname, "../../..")
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    let buffer = Buffer.alloc(0),
      seq = 0,
      stderr = "";
    const pending = new Map();
    child.stderr.on("data", c => (stderr += c));
    child.stdout.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const end = buffer.indexOf("\r\n\r\n");
        if (end < 0) return;
        const match = /Content-Length: (\d+)/.exec(buffer.subarray(0, end).toString());
        if (!match) return;
        const length = Number(match[1]);
        if (buffer.length < end + 4 + length) return;
        const msg = JSON.parse(buffer.subarray(end + 4, end + 4 + length));
        buffer = buffer.subarray(end + 4 + length);
        if (msg.type === "response" && pending.has(msg.request_seq)) {
          const { resolve, reject, timer } = pending.get(msg.request_seq);
          pending.delete(msg.request_seq);
          clearTimeout(timer);
          msg.success ? resolve(msg.body) : reject(new Error(msg.message));
        }
      }
    });
    function request(command, args) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`tsserver ${command} timed out: ${stderr}`)),
          30000
        );
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(
          JSON.stringify({ seq: id, type: "request", command, arguments: args }) + "\n"
        );
      });
    }
    try {
      await request("open", { file, fileContent: source, projectRootPath: dir });
      const ds = await request("semanticDiagnosticsSync", { file });
      const d = ds.find(d => d.text.includes("[READ_IN_SETUP]"));
      assert.ok(d, JSON.stringify(ds));
      assert.equal(d.start.line, 4);
      assert.equal(d.start.offset, 17);
      await request("open", { file: colorFile, fileContent: colors, projectRootPath: dir });
      const qi = await request("quickinfo", { file: colorFile, line: 3, offset: 18 });
      assert.match(
        qi.displayString,
        /DocPage: pending false; fails NotFound; may-wait false; requires none/
      );
      assert.equal(qi.start.line, 3);
      assert.equal(qi.start.offset, 17);
      await request("change", {
        file,
        line: 4,
        offset: 17,
        endLine: 4,
        endOffset: 24,
        insertString: "1"
      });
      const fixed = await request("semanticDiagnosticsSync", { file });
      assert.equal(fixed.length, 0, JSON.stringify(fixed));
    } finally {
      for (const { timer } of pending.values()) clearTimeout(timer);
      child.kill();
      await new Promise(resolve => child.once("exit", resolve));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
);
