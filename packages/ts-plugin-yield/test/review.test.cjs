const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { makeService, root, ts } = require("./helpers.cjs");
const fixture = path.join(root, "review-app");
function files(variant) {
  const input = Object.fromEntries(
    ["App.tsx", "api.ts", "index.tsx"].map(f => [
      f,
      fs.readFileSync(path.join(fixture, "src", f), "utf8")
    ])
  );
  if (variant) input["App.tsx"] = fs.readFileSync(path.join(fixture, "variants", variant), "utf8");
  return input;
}
function diagnostics(service) {
  return ["App.tsx", "api.ts", "index.tsx"].flatMap(f => service.diagnostics(path.join(root, f)));
}
test("the reviewer's unchanged app has no errors", () => {
  const { service } = makeService(files());
  try {
    assert.deepEqual(diagnostics(service), []);
  } finally {
    service.dispose();
  }
});
test("hydrate also reports the pending read with the handoff as a related location", () => {
  const input = files("s2a_noloading.tsx");
  input["index.tsx"] = input["index.tsx"].replaceAll("render", "hydrate");
  const { service } = makeService(input);
  try {
    const d = diagnostics(service).find(d => d.messageText.includes("[PENDING_ROOT]"));
    assert.equal(path.basename(d.file.fileName), "App.tsx");
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 17);
    assert.equal(
      d.relatedInformation[0].file.getLineAndCharacterOfPosition(d.relatedInformation[0].start)
        .line + 1,
      3
    );
  } finally {
    service.dispose();
  }
});
test("an effect failure uses handler advice at its throw site", () => {
  const input = files();
  input["App.tsx"] = input["App.tsx"]
    .replace("createSignal,", "createEffect, createSignal,")
    .replace(
      "  const twice =",
      "  createEffect(() => count(), () => { throw new Error('effect'); });\n  const twice ="
    );
  const { service } = makeService(input);
  try {
    const d = diagnostics(service).find(d => d.messageText.includes("[FOREIGN_HANDOFF]"));
    assert.ok(d);
    assert.equal(path.basename(d.file.fileName), "App.tsx");
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 8);
    assert.match(d.messageText, /Catch.*handler.*fails contract/);
    assert.doesNotMatch(d.messageText, /Errored/);
  } finally {
    service.dispose();
  }
});
test("a component Error throw is a failure path rather than a missing JSX return", () => {
  const input = files("m03_throw_string.tsx");
  input["App.tsx"] = input["App.tsx"]
    .replace("count() > 100", "Math.random() > 0.5")
    .replace("throw 'too big'", "throw new Error('too big')");
  const { service } = makeService(input);
  try {
    const ds = diagnostics(service);
    assert.ok(ds.every(d => !d.messageText.includes("SUGAR_RETURN")));
    const d = ds.find(d => d.messageText.includes("[NATIVE_SETUP_FAILURE]"));
    assert.ok(d, JSON.stringify(ds.map(d => d.messageText)));
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 8);
    assert.match(d.messageText, /Move this throw.*memo.*attempt/);
  } finally {
    service.dispose();
  }
});
test("a timer that really can fail reports its operation, not the component name", () => {
  const input = files("m07_timeout_read.tsx");
  input["App.tsx"] = input["App.tsx"]
    .replace("const ThemeCtx", "declare function risk(n: number): void;\nconst ThemeCtx")
    .replace("console.log(count())", "risk(count())");
  const { service } = makeService(input);
  try {
    const d = diagnostics(service).find(d => d.messageText.includes("[NATIVE_CALLBACK_FAILURE]"));
    assert.ok(d);
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 9);
    assert.doesNotMatch(d.messageText, /\[generated\]/);
  } finally {
    service.dispose();
  }
});
test("catching inside the reviewer's sync and async handlers removes their failure", () => {
  for (const variant of ["m03c_throw_in_handler.tsx", "m04_async_handler.tsx"]) {
    const input = files(variant);
    input["App.tsx"] = variant.startsWith("m03c")
      ? input["App.tsx"].replace(
          "throw new Error('x')",
          "{ try { throw new Error('x'); } catch { /* @yield-absorb: test deliberately ignores this failure */ } }"
        )
      : input["App.tsx"].replace(
          "await fetchItems(); throw new Error('nope');",
          "try { await fetchItems(); throw new Error('nope'); } catch { /* @yield-absorb: test deliberately ignores this failure */ }"
        );
    const { service } = makeService(input);
    try {
      assert.deepEqual(diagnostics(service), [], variant);
    } finally {
      service.dispose();
    }
  }
});
for (const c of require("./fixtures/review-app/expectations.json"))
  test(`review: ${c.variant}`, () => {
    const { service } = makeService(files(c.variant));
    try {
      const ds = diagnostics(service);
      if (!c.code) return assert.deepEqual(ds, []);
      const d = ds.find(d => d.messageText.includes(`[${c.code}]`) && d.code === c.tsCode);
      assert.ok(d, JSON.stringify(ds.map(d => d.messageText)));
      assert.equal(d.code, c.tsCode);
      assert.equal(path.basename(d.file.fileName), c.file);
      assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, c.line);
      assert.doesNotMatch(d.messageText, /\[generated\]|provenance|may-wait|snapshot-versus-path/);
      if (["PENDING_ROOT", "NO_PROVIDER", "FOREIGN_HANDOFF"].includes(c.code)) {
        const r = d.relatedInformation.find(r => path.basename(r.file.fileName) === "index.tsx");
        assert.ok(r);
        assert.equal(r.file.getLineAndCharacterOfPosition(r.start).line + 1, 3);
      }
      if (["m03c_throw_in_handler.tsx", "m04_async_handler.tsx"].includes(c.variant)) {
        assert.match(d.messageText, /handler.*try\/catch.*declare the failure/);
        assert.doesNotMatch(d.messageText, /Errored/);
      }
    } finally {
      service.dispose();
    }
  });
test("For value calls remain errors; every generated TS error survives mapping, including synthetic helpers", () => {
  const { service } = makeService(files("for-call.tsx"));
  try {
    const state = service.refresh(),
      file = path.join(root, "App.tsx");
    // A genuinely generated helper with no authored position must still be reported.
    state.generated.set(
      file,
      state.generated.get(file) + '\nconst __generatedBad: number = "wrong";'
    );
    const raw = state.ls
      .getSemanticDiagnostics(file)
      .filter(d => d.category === ts.DiagnosticCategory.Error);
    const ds = service.diagnostics(file);
    assert.equal(ds.filter(d => d.category === ts.DiagnosticCategory.Error).length, raw.length);
    const call = ds.find(d => d.code === 2349);
    assert.ok(call);
    assert.equal(call.file.getLineAndCharacterOfPosition(call.start).line + 1, 17);
    assert.match(ds.find(d => d.code === 2322).messageText, /\[generated\]/);
  } finally {
    service.dispose();
  }
});
test("CLI prints the original For error and both locations for a missing boundary", () => {
  const dir = path.join(__dirname, ".native-generated", "review-cli-" + process.pid);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ["src", "tsconfig.json"])
    fs.cpSync(path.join(fixture, name), path.join(dir, name), { recursive: true });
  const run = variant => {
    fs.writeFileSync(path.join(dir, "src/App.tsx"), files(variant)["App.tsx"]);
    return spawnSync(process.execPath, [path.join(__dirname, "../src/cli.cjs"), "check", dir], {
      encoding: "utf8"
    });
  };
  try {
    const call = run("for-call.tsx");
    assert.equal(call.status, 1, call.stdout + call.stderr);
    assert.match(call.stdout, /App\.tsx:17:\d+ error TS2349/);
    const boundary = run("s2a_noloading.tsx");
    assert.equal(boundary.status, 1, boundary.stdout + boundary.stderr);
    assert.match(boundary.stdout, /App\.tsx:17:\d+ error TS1360: \[PENDING_ROOT\]/);
    assert.match(boundary.stdout, /related: .*index\.tsx:3:15/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
