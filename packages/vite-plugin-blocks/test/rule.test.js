// Fixture parity (D-003, D-043). The expected outputs under fixtures/ were
// generated once from the fork's Rust compiler while it carried the rule, and
// the plugin's output, compiled, reproduced them byte for byte. D-043 removed
// the rule and moved the plugin's `perform` import onto the first statement's
// line; the compiled outputs were regenerated then, and differ from the Rust
// rule's only in where that import line sits (fixtures/generate.mjs has the
// details). They are the oracle now; the refusal messages are still the Rust
// rule's.
//
// What is compared: the JSX compiler's output for the plugin's output, against
// the checked-in output. Byte-equality, nothing normalized.
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@babel/core";
import { describe, expect, it } from "vitest";
import {
  BlocksRuleError,
  REFUSALS,
  applyBlocksRule,
  babelPluginBlocks,
  blocksRule,
  transform
} from "../src/index.js";
import { MODES, TWIN_SAMPLES, twinFilename } from "./fixtures/generate.mjs";

const require = createRequire(import.meta.url);
const compiler = require("@solidjs/compiler");
const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url));
const rule = JSON.parse(readFileSync(join(fixtures, "rule.json"), "utf8"));
const expected = (name, mode) =>
  readFileSync(join(fixtures, `compiled/${name}.${mode}.out`), "utf8");
const compile = (code, filename, mode) =>
  compiler.transform(code, { filename, ...MODES[mode] }).code;
// the rule alone: the compiler's rule had no lazy pass (that is tested in lazy.test.js)
const throughPlugin = (code, filename) => transform(code, { filename, lazy: false })?.code ?? code;

describe("fixture parity with the checked-in outputs", () => {
  it("the refusal list is the pinned list", () => {
    expect(Object.keys(REFUSALS).sort()).toEqual([...rule.refusals].sort());
  });

  rule.accepted.forEach((source, i) => {
    for (const mode of Object.keys(MODES)) {
      it(`accepted #${i} (${mode}): ${source}`, () => {
        expect(compile(throughPlugin(source, "case.tsx"), "case.tsx", mode)).toBe(
          expected(`accepted-${i}`, mode)
        );
      });
    }
  });

  for (const { code, source, error } of rule.refused) {
    it(`refuses ${code}: ${source}`, () => {
      let thrown;
      try {
        transform(source, { filename: "case.tsx" });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(BlocksRuleError);
      expect(thrown.code).toBe(code);
      // the compiler's message, position included
      expect(thrown.message).toBe(error);
    });
  }

  for (const [twin, file] of Object.entries(TWIN_SAMPLES)) {
    const source = readFileSync(join(fixtures, "twins", twin, basename(file)), "utf8");
    const filename = twinFilename(twin, file);
    for (const mode of Object.keys(MODES)) {
      it(`${twin}/${file} (${mode})`, () => {
        expect(compile(throughPlugin(source, filename), filename, mode)).toBe(expected(twin, mode));
      });
    }
  }
});

describe("transform()", () => {
  it("returns null when nothing changes", () => {
    expect(transform("const a = 1;", { filename: "a.tsx" })).toBeNull();
    expect(
      transform("function* v() { const x = yield* a; return <p>{x}</p>; }", { filename: "a.tsx" })
    ).toBeNull();
    // a hole in a nested function is that function's, not this JSX's
    expect(
      transform("function* v() { return <p onClick={() => go()}>{x}</p>; }", { filename: "a.tsx" })
    ).toBeNull();
  });

  it("keeps TypeScript and the formatting: the output is the input plus the edits", () => {
    for (const [twin, file] of Object.entries(TWIN_SAMPLES)) {
      const source = readFileSync(join(fixtures, "twins", twin, basename(file)), "utf8");
      const out = transform(source, { filename: twinFilename(twin, file), lazy: false }).code;
      // the import sits on the first statement's line: no line moves
      const IMPORT = 'import { perform as _$perform } from "solid-blocks"; ';
      expect(out.split("\n").length).toBe(source.split("\n").length);
      // (each sample's first statement is an import, after its leading comments)
      expect(out.indexOf(IMPORT)).toBe(source.search(/^import /m));
      // apart from that and `yield* ` → `_$perform(` and its `)`, every
      // character is the input's (the twins are prettier-formatted: `yield* `)
      const holes = out.match(/_\$perform\(/g).length;
      const body = out.replace(IMPORT, "");
      expect(body.length).toBe(
        source.length + holes * ("_$perform(".length + 1 - "yield* ".length)
      );
      const noParens = text => text.replace(/\)/g, "");
      expect(noParens(body.replace(/_\$perform\(/g, "yield* "))).toBe(noParens(source));
    }
  });

  it("a block-component call in a hole is one hole; its argument is left as written (D-062)", () => {
    const source =
      "function* v() { return <ul>{yield* Card({ todo, children: function* () { return <b>{yield* todo.title}</b>; } })}</ul>; }";
    expect(transform(source, { filename: "a.tsx" }).code).toBe(
      'import { perform as _$perform } from "solid-blocks"; ' +
        "function* v() { return <ul>{_$perform(Card({ todo, children: function* () { return <b>{_$perform(todo.title)}</b>; } }))}</ul>; }"
    );
  });

  it("a foreign tag's attributes and children are holes too (D-067)", () => {
    const source = "function* v() { return <Router url={yield* url}><p>{yield* x}</p></Router>; }";
    expect(transform(source, { filename: "a.tsx" }).code).toContain(
      "<Router url={_$perform(url)}><p>{_$perform(x)}</p></Router>"
    );
  });

  it("keeps a parenthesized sequence argument one argument", () => {
    const out = transform("function* v() { return <p>{yield* (a, b)}</p>; }", {
      filename: "a.jsx"
    }).code;
    expect(out).toContain("{_$perform((a, b))}");
  });

  it("imports from the configured blocks module, before the first statement", () => {
    const out = transform(
      '#!/usr/bin/env node\n"use client";\n// a comment\nfunction* v() { return <p>{yield* n}</p>; }',
      { filename: "a.jsx", blocksModule: "my-blocks" }
    ).code;
    // after the hashbang, the directive prologue and the leading comments;
    // on the statement's own line, so no line moves
    expect(out).toBe(
      '#!/usr/bin/env node\n"use client";\n// a comment\nimport { perform as _$perform } from "my-blocks"; function* v() { return <p>{_$perform(n)}</p>; }'
    );
  });

  it("does not shadow a binding named _$perform", () => {
    const out = transform("const _$perform = 1; function* v() { return <p>{yield* n}</p>; }", {
      filename: "a.jsx"
    }).code;
    expect(out).toMatch(/^import \{ perform as (_\$perform\d+) \}/);
    const local = /perform as (\S+) \}/.exec(out)[1];
    expect(out).toContain(`{${local}(n)}`);
  });

  it("reports every refusal, with Vite's id and loc", () => {
    let thrown;
    try {
      transform("function* v() {\n  return <b ref={yield* r} onClick={yield* h} />;\n}", {
        filename: "/abs/a.tsx"
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown.refusals.map(r => r.code)).toEqual([
      "BLOCKS_YIELD_IN_REF",
      "BLOCKS_YIELD_IN_EVENT"
    ]);
    expect(thrown.message.split("\n")).toHaveLength(2);
    expect(thrown.id).toBe("/abs/a.tsx");
    expect(thrown.loc).toEqual({ file: "/abs/a.tsx", line: 2, column: 17 });
  });

  it("maps every hole back to its yield*", async () => {
    const { TraceMap, originalPositionFor } = await import("@jridgewell/trace-mapping");
    const source = "function* v() {\n  return <p title={yield* t}>\n    {yield* n}\n  </p>;\n}\n";
    const out = transform(source, { filename: "a.tsx" });
    const map = new TraceMap(out.map);
    const lines = out.code.split("\n");
    for (const [needle, line, column] of [
      ["_$perform(t)", 2, source.split("\n")[1].indexOf("yield* t") + 1],
      ["_$perform(n)", 3, source.split("\n")[2].indexOf("yield* n") + 1]
    ]) {
      const genLine = lines.findIndex(l => l.includes(needle));
      const pos = originalPositionFor(map, {
        line: genLine + 1,
        column: lines[genLine].indexOf(needle)
      });
      expect([pos.line, pos.column + 1]).toEqual([line, column]);
    }
  });
});

describe("babelPluginBlocks", () => {
  const viaBabel = (code, options) =>
    babel.transformSync(code, {
      babelrc: false,
      configFile: false,
      filename: "case.tsx",
      parserOpts: { plugins: ["jsx", "typescript"] },
      plugins: [[babelPluginBlocks, options]]
    });

  rule.accepted.forEach((source, i) => {
    it(`accepted #${i} compiles to the checked-in output`, () => {
      const out = viaBabel(source);
      expect(out.metadata.blocks.holes).toBe(source.includes("<p>{x}</p>") ? false : true);
      expect(compile(out.code, "case.tsx", "dom")).toBe(expected(`accepted-${i}`, "dom"));
    });
  });

  for (const { code, source } of rule.refused) {
    it(`refuses ${code}`, () => {
      expect(() => viaBabel(source)).toThrow(`[${code}]`);
    });
  }

  it("imports from the configured blocks module", () => {
    expect(
      viaBabel("function* v() { return <p>{yield* n}</p>; }", { blocksModule: "x" }).code
    ).toMatch(/import \{ perform as _\$perform \} from "x"/);
  });

  it("the rule is one function shared by both appliers", () => {
    let seen;
    babel.transformSync("function* v() { return <p a={yield* a}>{yield* b}</p>; }", {
      babelrc: false,
      configFile: false,
      filename: "case.jsx",
      parserOpts: { plugins: ["jsx"] },
      plugins: [
        () => ({
          visitor: {
            Program(path) {
              const { holes, refusals } = blocksRule(path);
              seen = [holes.length, refusals.length];
              applyBlocksRule(path, babel.types);
            }
          }
        })
      ]
    });
    expect(seen).toEqual([2, 0]);
  });
});

it("fixtures/ holds a sample of every JSX twin", () => {
  expect(readdirSync(join(fixtures, "twins")).sort()).toEqual(Object.keys(TWIN_SAMPLES).sort());
});
