import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { partName } from "./reachability.js";
export const jsonBytes = value => Buffer.byteLength(JSON.stringify(value) ?? "undefined");
export function docsPayload(html) {
  // Only our locally generated SSR payload, in a context with no host I/O.
  const context = vm.createContext({});
  vm.runInContext("self=globalThis;window=globalThis;_$HY={r:{}};", context);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))
    if (match[1].includes("self.$R")) vm.runInContext(match[1], context, { timeout: 1000 });
  const values = Object.values(context.$R ?? {});
  const article = values.find(v => v?.slug === "overview" && Array.isArray(v.chapters));
  const site = values.find(v => v?.title === "Field Notes" && Array.isArray(v.navigation));
  const comments = values.find(v => Array.isArray(v) && v[0]?.name === "Ada" && v[0]?.text);
  if (!article || !site || !comments) throw new Error("SSR payload inventory changed");
  return { htmlSHA256: createHash("sha256").update(html).digest("hex"), article, site, comments };
}
export function literal(path, seen = new Set()) {
  if (!path?.node || seen.has(path.node)) throw new Error("not a literal");
  seen.add(path.node);
  const n = path.node;
  if (/^(TSAsExpression|TSNonNullExpression|TSTypeAssertion)$/.test(n.type))
    return literal(path.get("expression"), seen);
  if (path.isNullLiteral()) return null;
  if (path.isStringLiteral() || path.isNumericLiteral() || path.isBooleanLiteral()) return n.value;
  if (path.isIdentifier()) {
    if (n.name === "undefined") return undefined;
    const binding = path.scope.getBinding(n.name);
    if (binding?.constant && binding.path.isVariableDeclarator())
      return literal(binding.path.get("init"), seen);
  }
  if (path.isArrayExpression()) return path.get("elements").map(p => literal(p, new Set(seen)));
  if (path.isObjectExpression())
    return Object.fromEntries(
      path.get("properties").map(p => {
        if (!p.isObjectProperty() || p.node.computed) throw new Error("not a literal object");
        return [p.node.key.name ?? p.node.key.value, literal(p.get("value"), new Set(seen))];
      })
    );
  if (path.isUnaryExpression() && n.operator === "-") return -literal(path.get("argument"), seen);
  throw new Error("not a literal");
}
const seed = [
  { id: "1700000000000-a", title: "write routines", completed: false },
  { id: "1700000000001-b", title: "ship routines", completed: true }
];
export function estimateSource(twin, p, payload) {
  const name = partName(p).split("@")[0],
    key = name.split(".").at(-1);
  let value, basis;
  try {
    if (p.kind !== "cell") throw new Error();
    value = literal(p.path.get("arguments")[0]);
    basis = "authored initial value";
  } catch {
    basis = "fake API / parity seed estimate";
    if (twin.startsWith("todos")) {
      value = {
        todos: seed,
        filtered: seed,
        filter: "all",
        ss: 0,
        allCompleted: false,
        hasTodos: true,
        classes: ["todo", { completed: false, pending: false, errored: false }],
        remaining: 1,
        completed: 1
      }[key];
    } else if (twin === "docs-yield") {
      if (key === "article" || key === "site" || key === "rows") {
        value = payload[{ article: "article", site: "site", rows: "comments" }[key]];
        basis = "completed library SSR payload (/); route instances use overview size";
      } else
        value = {
          results: [{ title: "Result: local", href: "/docs/widgets" }],
          picture:
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18">A</text></svg>'
            )
        }[key];
    } else if (twin === "room-yield") {
      const me = { id: "931ezr1l", name: "quick-badger" },
        room = "design";
      const members = [{ ...me, since: 1767268800000 }];
      value = {
        room,
        me,
        who: { room, members, connection: 1 },
        joined: true,
        store: {
          messages: [
            {
              id: "design:welcome",
              from: "system",
              text: "Welcome to #design. Open this page in another tab to see presence move.",
              at: 1767268800000
            }
          ]
        },
        card: {
          name: room,
          topic: "Pixels, type, and taste",
          members,
          activity: { tick: 1, of: 8, posts: 1 },
          connection: 1
        },
        members,
        activity: { tick: 1, of: 8, posts: 1 },
        ticks: [true, false, false, false, false, false, false, false],
        text: "Reading 1 message in #design…",
        stats: { room, total: 1 }
      }[key];
    } else if (twin === "effect-yield") {
      value = {
        cart: [
          { id: "sku_signal", name: "Signal (fine-grained)", price: 19.99, quantity: 1 },
          { id: "sku_fiber", name: "Fiber (interruptible)", price: 24.5, quantity: 2 },
          { id: "sku_boundary", name: "Boundary (loading)", price: 9.75, quantity: 1 }
        ],
        orders: [],
        results: [
          { name: "solid-js", description: "Fine-grained reactive UI library", downloads: 1450000 }
        ],
        total: 78.74,
        inFlight: false,
        state: "waiting",
        newestFirst: []
      }[key];
    } else if (twin === "rendering-yield") {
      value = {
        location: "/",
        user: { firstName: "Jon", lastName: "Snow" },
        info: ["Something Interesting", "Something else you might care about", "Or maybe not"],
        memoItems: [{ id: 1, text: "First item" }],
        item: { title: "Test Item" },
        value: "A ready",
        feed: {
          user: "Ada",
          items: [
            { text: "Shipped release #1" },
            { text: "Reviewed 3 pull requests" },
            { text: "Closed 3 issues" }
          ]
        },
        cell:
          p.owner?.name === "Skeleton"
            ? { user: "Ada", items: [{ text: "Shipped release #1" }] }
            : [{ id: 1, text: "First item" }]
      }[key];
    } else if (twin.startsWith("sierpinski")) {
      value = {
        scale: 1,
        slowChildren: 0,
        dotX: -12.5,
        dotY: -12.5,
        half: 500,
        top: -250,
        bottom: 250,
        left: -500,
        right: 500
      }[key];
    } else if (twin === "hackernews-spa-yield") {
      value = {
        page: 1,
        type: "top",
        stories: payload.hnFeed,
        story: payload.hnStory,
        user: payload.hnUser
      }[key];
    }
    if (value === undefined) throw new Error(`Missing data estimate: ${twin}/${name}`);
  }
  return { name, value, bytes: jsonBytes(value), basis };
}
export function edgeData(twin, reached, g, payload) {
  const entries = [],
    used = new Set();
  for (const p of reached.parts)
    if (["cell", "memo"].includes(p.kind)) {
      const entry = estimateSource(twin, p, payload);
      entries.push({ id: p.id, ...entry });
      used.add(p.id);
    }
  const seenValues = new Set();
  const capture = v => {
    if (!v || seenValues.has(v)) return;
    seenValues.add(v);
    if (
      ["cell", "memo", "event", "setter", "write", "refresh"].includes(v.kind) ||
      v.rendered ||
      v.callable
    )
      return;
    if (v.known) {
      if (!used.has(v.id)) {
        used.add(v.id);
        entries.push({
          id: v.id,
          name: v.binding?.name ?? "constant prop",
          value: v.literal,
          bytes: jsonBytes(v.literal),
          basis: "statically known input value"
        });
      }
      return;
    }
    // Router props are opaque to C1, but their representative fake route is
    // known in the parity script. Price the string field the handler reads.
    if (twin === "docs-yield" && v.kind === "field:slug") {
      const value = "start";
      if (!used.has("route:slug")) {
        used.add("route:slug");
        entries.push({
          id: "route:slug",
          name: "props.slug",
          value,
          bytes: jsonBytes(value),
          basis: "parity route /docs/start estimate"
        });
      }
      return;
    }
    for (const d of v.deps) capture(d);
  };
  for (const p of reached.parts) for (const v of p.readValues ?? []) capture(v);
  // Serializable lexical captures, including the carousel's pictures. Do not
  // charge DOM event arguments or API response values as SSR captures.
  for (const p of reached.parts)
    for (const body of p.bodies ?? [p.path]) {
      body?.traverse({
        ReferencedIdentifier(q) {
          const b = q.scope.getBinding(q.node.name);
          if (
            !b?.path.isVariableDeclarator() ||
            !b.constant ||
            (b.path.node.start >= body.node.start && b.path.node.end <= body.node.end)
          )
            return;
          const id = `${g.a.moduleOf.get(b.path.node)?.id}:${b.path.node.start}`;
          if (used.has(id)) return;
          try {
            const value = literal(b.path.get("init"));
            used.add(id);
            entries.push({
              id,
              name: q.node.name,
              value,
              bytes: jsonBytes(value),
              basis: "literal lexical capture"
            });
          } catch {
            /* Function/source captures are represented by graph edges. */
          }
        }
      });
    }
  return { bytes: entries.reduce((n, e) => n + e.bytes, 0), entries };
}
export function readPayload(path) {
  return docsPayload(readFileSync(path, "utf8"));
}
