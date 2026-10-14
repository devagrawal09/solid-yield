import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffHeaps } from "./heap-diff.mjs";

// A diamond converges on owner, which alone retains a growing object.
// A weak root shortcut must not change its immediate dominator.
function snapshot(growing) {
  const names = ["root", "left", "right", "owner", "Growing"];
  const graph = [[1, 2], [3], [3], growing ? [4] : [], []];
  const nodes = [],
    edges = [];
  for (let i = 0; i < names.length; i++) {
    const weak = i === 0 && growing;
    nodes.push(i === 0 ? 0 : 1, i, i * 2 + 1, 32, graph[i].length + Number(weak));
    for (const to of graph[i]) edges.push(0, to, to * 5);
    if (weak) edges.push(1, 4, 20);
  }
  // The before snapshot has no growing object, keeping all earlier V8 IDs stable.
  if (!growing) nodes.splice(-5);
  return {
    snapshot: {
      meta: {
        node_fields: ["type", "name", "id", "self_size", "edge_count"],
        node_types: [["synthetic", "object"]],
        edge_fields: ["type", "name_or_index", "to_node"],
        edge_types: [["property", "weak"]]
      }
    },
    strings: names,
    nodes,
    edges
  };
}

test("heap diff counts new constructors and computes dominators across a diamond", () => {
  const dir = mkdtempSync(join(tmpdir(), "yield-heap-test-"));
  try {
    const a = join(dir, "before.json"),
      b = join(dir, "after.json");
    writeFileSync(a, JSON.stringify(snapshot(false)));
    writeFileSync(b, JSON.stringify(snapshot(true)));
    const result = diffHeaps(a, b, "object:Growing");
    assert.deepEqual(
      result.diff.find(x => x.name === "object:Growing"),
      { name: "object:Growing", count: 1, bytes: 32 }
    );
    assert.equal(result.newObjects, 1);
    assert.deepEqual(
      result.paths[0].chain.map(x => x.name),
      ["Growing", "owner", "root"]
    );
    assert.equal(result.paths[0].path.at(-1).from, "owner");
    assert.equal(result.paths[0].path.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
