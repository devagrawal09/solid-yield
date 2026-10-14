// Programs for the native surface check: one component per form, host and
// variant, and what plain Solid says each must get (forms.mjs).
import { forms, eventOnly } from "./forms.mjs";
import { jsxCases } from "./jsx.mjs";

export const hosts = ["hole", "attribute", "memo", "compute", "phase", "event", "setup"];
export const variants = ["read", "write", "pending"];

const state = `  const [n, setN] = createSignal(1);
  const [items, setItems] = createSignal([1, 2, 3]);
  const [maybe, setMaybe] = createSignal<number | undefined>(undefined);
  const [obj, setObj] = createSignal({ inner: { value: 1 }, label: "x" });
  const [store, setStore] = createStore({ user: { name: "a" }, list: [{ title: "t", done: false }] });
  const [out, setOut] = createSignal<unknown>(null);`;

// The pending variant: every reactive slot an async memo (pending until it
// settles; the store stays settled), the app rendered with no Loading. A form
// must carry the read's color to its host: what plain Solid suspends, the
// check reports.
const pendingState = `  const n = createMemo(async () => 1);
  const items = createMemo(async () => [1, 2, 3]);
  const maybe = createMemo(async (): Promise<number | undefined> => undefined);
  const obj = createMemo(async () => ({ inner: { value: 1 }, label: "x" }));
  const [store, setStore] = createStore({ user: { name: "a" }, list: [{ title: "t", done: false }] });
  const [out, setOut] = createSignal<unknown>(null);`;

/** Whether a form reads a slot the pending variant makes pending. @param {import("./forms.mjs").Form} form */
const readsPending = form =>
  /\b(n|items|maybe|obj)\(\)/.test(form.body(slots("read"))) ||
  /\btwice\(n\)/.test(form.body(slots("read")));

/** @param {"read" | "write" | "pending"} variant */
const slots = variant => ({
  n: "n()",
  items: "items()",
  maybe: "maybe()",
  obj: "obj()",
  store: "store",
  /** @param {string} x */
  sink: x => (variant === "read" ? `seen.push(${x});` : `setOut(${x});`)
});

/**
 * What plain Solid says: a read is reactive anywhere but the component body;
 * a write belongs in an event or an effect's phase.
 * @param {string} form @param {string} host @param {"read" | "write"} variant
 * @returns {string[]}
 */
export function expected(form, host, variant) {
  const spec = [...forms, ...eventOnly].find(f => f.id === form);
  if (variant === "pending") {
    const pending = !!spec && readsPending(spec);
    const rejects = host === "event" && spec?.throws ? ["EVENT_REJECTS"] : [];
    // rendered: what a form may throw reaches the root (FOREIGN_HANDOFF)
    const fails = spec?.throws ? ["FOREIGN_HANDOFF"] : [];
    if (host === "setup")
      return form !== "untrack" ? ["READ_IN_SETUP"] : pending ? ["COLORED_CAPTURE"] : [];
    // what a view or a memo it shows reads suspends the app: Loading
    if (["hole", "attribute", "memo"].includes(host))
      return [...(pending ? ["PENDING_ROOT"] : []), ...fails];
    // an effect's compute waits for it; an event waits and catches its own
    if (host === "compute") return fails;
    if (host === "event") return rejects;
    // an effect phase does not wait: read it in the compute and pass the value
    return pending ? ["PENDING_IN_EFFECT"] : fails;
  }
  // `untrack` is how Solid reads once in the body; the body never writes
  if (host === "setup")
    return form !== "untrack"
      ? ["READ_IN_SETUP"]
      : variant === "write"
        ? ["WRITE_IN_REACTIVE"]
        : [];
  // a handler's failure nobody catches is the event's (EVENT_REJECTS)
  const rejects = host === "event" && spec?.throws ? ["EVENT_REJECTS"] : [];
  if (variant === "read" || ["event", "phase"].includes(host)) return rejects;
  return ["WRITE_IN_REACTIVE"];
}

/**
 * @param {import("./forms.mjs").Form} form @param {string} host
 * @param {"read" | "write"} variant
 */
export function program(form, host, variant) {
  const reading = variant !== "write";
  const s = slots(reading ? "read" : "write");
  const body = form.body(s);
  const block = reading ? `const seen: unknown[] = [];\n${body}` : body;
  const result = reading ? `seen.join(",")` : `1`;
  const thunk = `(() => {\n${block}\nreturn ${result};\n})()`;
  const value = form.expr && reading ? `String(${form.expr(s)})` : thunk;
  const async = eventOnly.includes(form) ? "async " : "";
  /** @type {Record<string, string>} */
  const view = {
    hole: `  return <p>{${value}}</p>;`,
    attribute: `  return <p title={String(${value})}>x</p>;`,
    memo: `  const m = createMemo(() => {\n${block}\nreturn ${result};\n});\n  return <p>{m()}</p>;`,
    compute: `  createEffect(\n() => {\n${block}\nreturn ${result};\n},\nvalue => {\nconsole.log(value);\n}\n);\n  return <p>{String(out())}</p>;`,
    phase: `  createEffect(\n() => n(),\n() => {\n${block}\n}\n);\n  return <p>{String(out())}</p>;`,
    event: `  return <button onClick={${async}() => {\n${block}\n}}>{String(out())}</button>;`,
    setup: `${block}\n  return <p>{String(${result})}</p>;`
  };
  const pending = variant === "pending";
  return `import { createSignal, createMemo, createEffect, createStore, untrack, type Accessor } from "solid-js";
${pending ? 'import { render } from "@solidjs/web";\n' : ""}export function Surface() {
${pending ? pendingState : state}
${view[host]}
}
${pending ? "render(Surface, document.body);\n" : ""}`;
}

// A context's provider (the view) and one consumer (module level) each.
const counter = `type Counter = { count: () => number; bump: () => void };
const Ctx = createContext<Counter>();
`;
/** @type {Record<string, [string, string]>} */
const contextExtras = {
  "ctx-destructured": [
    `${counter}function Consumer() {
  const { count, bump } = useContext(Ctx);
  return <button onClick={() => bump()}>{count()}</button>;
}
`,
    ""
  ],
  "ctx-members": [
    `${counter}function Consumer() {
  const counter = useContext(Ctx);
  return <button onClick={() => counter.bump()}>{counter.count()}</button>;
}
`,
    ""
  ],
  "ctx-guarded": [
    `${counter}function Consumer() {
  const counter = useContext(Ctx);
  if (!counter) throw new Error("no provider");
  return <button onClick={counter.bump}>{counter.count()}</button>;
}
`,
    ""
  ],
  "ctx-in-place": [
    `${counter}function Consumer() {
  return <p title={String(useContext(Ctx).count())}>{useContext(Ctx).count()}</p>;
}
`,
    ""
  ],
  "ctx-handler-member": [
    `${counter}function Consumer() {
  const { bump } = useContext(Ctx);
  return <button onClick={bump}>+</button>;
}
`,
    ""
  ],
  "ctx-tuple": [
    `const Pair = createContext<[() => number, { bump: () => void }]>();
function Consumer() {
  const [count, { bump }] = useContext(Pair);
  return <button onClick={() => bump()}>{count()}</button>;
}
`,
    ""
  ],
  "ctx-theme": [
    `const Theme = createContext("light");
function Consumer() {
  return <p>{useContext(Theme)}</p>;
}
`,
    ""
  ]
};

/** A JSX construct's program (jsx.mjs). @param {import("./jsx.mjs").JsxCase} c */
export function jsxProgram(c) {
  const solid = ["createSignal", "createMemo", "createEffect", "createStore", "untrack"];
  if (c.imports) solid.push(...c.imports.split(", "));
  /** @type {Record<string, [string, string]>} module-level and component-level additions */
  const extras = {
    pending: ["", "  const pending = createMemo(async () => 1);"],
    child: [
      "function Child(props: { value: number; label: string }) {\n  return <p>{props.value}{props.label}</p>;\n}\n",
      ""
    ],
    panel: [
      'import type { JSX } from "@solidjs/web";\nfunction Panel(props: { title: string; children: JSX.Element }) {\n  return <section><h2>{props.title}</h2>{props.children}</section>;\n}\n',
      ""
    ],
    increment: ["", "  const increment = () => setN(n() + 1);"],
    ref: ["", "  let input!: HTMLInputElement;"],
    row: ["function row(label: string) {\n  return <li>{label}</li>;\n}\n", ""],
    header: ["", "  const header = <h1>title</h1>;"],
    badge: ["", "  const badge = () => <b>{n()}</b>;"],
    ...contextExtras
  };
  const [module, local] = c.extra ? extras[c.extra] : ["", ""];
  return `import { ${solid.join(", ")} } from "solid-js";
${module}export function Surface() {
${state}
${local}
  return ${c.view};
}
`;
}

/** Every cell: form × host × variant, with its file name and expectation. */
export function cells() {
  const all = [];
  for (const form of [...forms, ...eventOnly])
    for (const host of eventOnly.includes(form) ? ["event"] : hosts)
      for (const variant of /** @type {const} */ (["read", "write", "pending"]))
        all.push({
          form: form.id,
          host,
          variant,
          file: `${host}/${variant}/${form.id}.tsx`,
          source: program(form, host, variant),
          expected: expected(form.id, host, variant)
        });
  for (const c of jsxCases)
    all.push({
      form: c.id,
      host: "view",
      variant: "jsx",
      file: `view/jsx/${c.id}.tsx`,
      source: jsxProgram(c),
      expected: c.expected ?? []
    });
  return all;
}

/**
 * The mutation program's surface corpus (scripts/mutation/corpus.mjs): each
 * form in a memo of a rendered app that checks clean, its sources pending
 * (an async memo each), shown in JSX under a Loading when the form reads
 * one and an Errored when it may throw (an event's handler catches its own).
 * `lines` is the form's span (the memo through its read in JSX): the operators' sites there are its mutants, and
 * the boundary deletions.
 */
export function mutationPrograms() {
  return [...forms, ...eventOnly].map(form => {
    const event = eventOnly.includes(form);
    const body = form.body(slots("read"));
    const pending = readsPending(form);
    const head = `import { createSignal, createMemo, createStore, untrack, Errored, Loading, type Accessor } from "solid-js";
import { render } from "@solidjs/web";
export function Surface() {
${pendingState}
`;
    const at = head.split("\n").length;
    if (event) {
      // a handler that may fail catches it, as a clean app's does
      const caught = form.throws
        ? `try {\n${body}\n} catch (e) {\n/* @yield-absorb: logged */\nconsole.error(e);\n}`
        : body;
      const handler = `  return (
    <button
      onClick={async () => {
        const seen: unknown[] = [];
${caught}
        setOut(seen.join(","));
      }}
    >
      {String(out())}
    </button>
  );`;
      return {
        form: form.id,
        source: `${head}${handler}\n}\nrender(Surface, document.body);\n`,
        lines: [at, at + handler.split("\n").length - 1]
      };
    }
    const memo = `  const m = createMemo(() => {
    const seen: unknown[] = [];
${body}
    return seen.join(",");
  });
`;
    let view = "<p>{m()}</p>";
    if (pending) view = `<Loading fallback={<p>…</p>}>${view}</Loading>`;
    if (form.throws) view = `<Errored fallback={() => <p>failed</p>}>${view}</Errored>`;
    const source = `${head}${memo}  return ${view};\n}\nrender(Surface, document.body);\n`;
    return { form: form.id, source, lines: [at, at + memo.split("\n").length - 1] };
  });
}
