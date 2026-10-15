// V8 constructor counts and retaining paths. Weak edges and WeakMap table
// shortcuts are excluded; live-key ephemeron edges remain.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function readHeap(file) {
  const s = JSON.parse(readFileSync(file, "utf8")),
    m = s.snapshot.meta;
  const nf = m.node_fields.length,
    ef = m.edge_fields.length;
  const field = n => m.node_fields.indexOf(n),
    edge = n => m.edge_fields.indexOf(n);
  const n = s.nodes.length / nf,
    starts = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++)
    starts[i + 1] = starts[i] + s.nodes[i * nf + field("edge_count")] * ef;
  const name = i => s.strings[s.nodes[i * nf + field("name")]];
  const type = i => m.node_types[0][s.nodes[i * nf]];
  const target = e => s.edges[e + edge("to_node")] / nf;
  const ignored = new Set();
  for (let i = 0; i < n; i++)
    if (type(i) === "array")
      for (let e = starts[i]; e < starts[i + 1]; e += ef)
        if (s.strings[s.edges[e + 1]]?.includes("part of key")) ignored.add(e);
  const etype = e => (ignored.has(e) ? "weak" : m.edge_types[0][s.edges[e]]);
  const ename = e =>
    ["element", "hidden"].includes(etype(e)) ? String(s.edges[e + 1]) : s.strings[s.edges[e + 1]];
  const counts = new Map();
  for (let i = 0; i < n; i++) {
    const k = type(i) + ":" + name(i),
      c = counts.get(k) || { count: 0, bytes: 0 };
    c.count++;
    c.bytes += s.nodes[i * nf + field("self_size")];
    counts.set(k, c);
  }
  return { s, n, nf, ef, starts, name, type, target, etype, ename, counts };
}
export function diffHeaps(aFile, bFile, wanted) {
  const [constructor, selectedId] = (wanted ?? "").split("#");
  const a = readHeap(aFile),
    b = readHeap(bFile);
  const diff = [...b.counts]
    .map(([name, v]) => ({
      name,
      count: v.count - (a.counts.get(name)?.count || 0),
      bytes: v.bytes - (a.counts.get(name)?.bytes || 0)
    }))
    .sort((a, b) => b.bytes - a.bytes);
  if (!wanted) return { files: [aFile, bFile], diff };
  // Iterative strong-edge DFS, followed by Lengauer-Tarjan immediate dominators.
  const { n, starts, ef, target, etype, name, type } = b,
    num = new Uint32Array(n),
    vertex = new Uint32Array(n + 1),
    parent = new Uint32Array(n + 1),
    semi = new Uint32Array(n + 1),
    label = new Uint32Array(n + 1),
    ancestor = new Uint32Array(n + 1),
    idom = new Uint32Array(n + 1),
    bucket = new Uint32Array(n + 1),
    next = new Uint32Array(n + 1);
  let count = 1;
  num[0] = 1;
  vertex[1] = 0;
  const stack = [0],
    cursor = [starts[0]];
  while (stack.length) {
    let i = stack.length - 1,
      v = stack[i],
      e = cursor[i];
    if (e >= starts[v + 1]) {
      stack.pop();
      cursor.pop();
      continue;
    }
    cursor[i] += ef;
    if (etype(e) === "weak") continue;
    const w = target(e);
    if (!num[w]) {
      num[w] = ++count;
      vertex[count] = w;
      parent[count] = num[v];
      stack.push(w);
      cursor.push(starts[w]);
    }
  }
  // predecessor linked lists, indexed by DFS number
  const head = new Int32Array(count + 1);
  head.fill(-1);
  const from = [],
    link = [];
  for (let v = 0; v < n; v++)
    if (num[v])
      for (let e = starts[v]; e < starts[v + 1]; e += ef) {
        if (etype(e) === "weak") continue;
        const w = num[target(e)];
        if (w) {
          from.push(num[v]);
          link.push(head[w]);
          head[w] = from.length - 1;
        }
      }
  for (let i = 1; i <= count; i++) semi[i] = label[i] = i;
  function evalNode(v) {
    if (!ancestor[v]) return label[v];
    const path = [];
    let x = v;
    while (ancestor[ancestor[x]]) {
      path.push(x);
      x = ancestor[x];
    }
    for (let j = path.length - 1; j >= 0; j--) {
      x = path[j];
      if (semi[label[ancestor[x]]] < semi[label[x]]) label[x] = label[ancestor[x]];
      ancestor[x] = ancestor[ancestor[x]];
    }
    return label[v];
  }
  for (let w = count; w >= 2; w--) {
    for (let e = head[w]; e !== -1; e = link[e])
      semi[w] = Math.min(semi[w], semi[evalNode(from[e])]);
    next[w] = bucket[semi[w]];
    bucket[semi[w]] = w;
    ancestor[w] = parent[w];
    for (let v = bucket[parent[w]]; v; v = next[v]) {
      const u = evalNode(v);
      idom[v] = semi[u] < semi[v] ? u : parent[w];
    }
    bucket[parent[w]] = 0;
  }
  for (let w = 2; w <= count; w++) if (idom[w] !== semi[w]) idom[w] = idom[idom[w]];
  const oldIds = new Set();
  const idfield = b.s.snapshot.meta.node_fields.indexOf("id");
  for (let i = 0; i < a.n; i++) oldIds.add(a.s.nodes[i * a.nf + idfield]);
  const candidates = [];
  for (let i = 0; i < n; i++)
    if (
      type(i) + ":" + name(i) === constructor &&
      (!selectedId || b.s.nodes[i * b.nf + idfield] === Number(selectedId)) &&
      !oldIds.has(b.s.nodes[i * b.nf + idfield]) &&
      num[i]
    )
      candidates.push(i);
  const paths = candidates.slice(0, 3).map(i => {
    const chain = [];
    for (let v = num[i]; v; v = idom[v])
      chain.push({
        name: name(vertex[v]),
        type: type(vertex[v]),
        id: b.s.nodes[vertex[v] * b.nf + idfield]
      });
    // Reverse BFS to root for named property edges, independent of dominators.
    const seen = new Set([num[i]]),
      queue = [num[i]],
      toward = new Map();
    let found = false;
    for (let q = 0; q < queue.length && !found; q++) {
      const w = queue[q];
      for (let e = head[w]; e !== -1; e = link[e]) {
        const v = from[e];
        if (!seen.has(v)) {
          seen.add(v);
          toward.set(v, w);
          queue.push(v);
          if (v === 1) {
            found = true;
            break;
          }
        }
      }
    }
    const path = [];
    for (let v = 1; v && toward.has(v); ) {
      const w = toward.get(v),
        p = vertex[v],
        t = vertex[w];
      let edgeName = "?";
      for (let e = starts[p]; e < starts[p + 1]; e += ef)
        if (target(e) === t && etype(e) !== "weak") {
          edgeName = b.ename(e);
          break;
        }
      path.push({ from: name(p), edge: edgeName, to: name(t), id: b.s.nodes[t * b.nf + idfield] });
      v = w;
    }
    return { chain, path };
  });
  return { files: [aFile, bFile], wanted, diff, newObjects: candidates.length, paths };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [a, b, wanted, out] = process.argv.slice(2);
  if (!a || !b)
    throw new Error(
      "Usage: node heap-diff.mjs before.heapsnapshot after.heapsnapshot [object:Constructor] [out.json]"
    );
  const result = diffHeaps(a, b, wanted);
  if (out) writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        diff: result.diff.filter(x => x.count > 0).slice(0, 25),
        newObjects: result.newObjects,
        paths: result.paths
      },
      null,
      2
    )
  );
}
