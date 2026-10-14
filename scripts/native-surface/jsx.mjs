// The JSX half of the native surface: each construct a Solid view is written
// with, reading reactive state, and what native mode must say about it.
// `[id, view, expected]`: `view` is the component's return (after `state` in
// programs.mjs); `extra` (optional) goes at module level, `imports` beside the
// Solid ones.

/** @typedef {{ id: string, view: string, expected?: string[], extra?: string, imports?: string }} JsxCase */

/** @type {JsxCase[]} */
export const jsxCases = [
  { id: "attribute", view: `<p title={String(n())} id={"n" + n()}>x</p>` },
  { id: "boolean-attribute", view: `<button disabled={n() > 2}>x</button>` },
  { id: "class", view: `<p class={n() > 1 ? "big" : "small"}>x</p>` },
  {
    id: "class-object",
    view: `<p class={{ big: n() > 1, done: store.list[0].done }}>x</p>`
  },
  {
    id: "style-object",
    view: `<p style={{ color: n() > 1 ? "red" : "blue", "font-size": n() + "px" }}>x</p>`
  },
  { id: "style-string", view: `<p style={"color: " + (n() > 1 ? "red" : "blue")}>x</p>` },
  { id: "data-aria", view: `<p data-n={n()} aria-label={obj().label}>x</p>` },
  { id: "text-content", view: `<p textContent={String(n())} />` },
  { id: "inner-html", view: `<div innerHTML={"<b>" + n() + "</b>"} />` },
  { id: "svg", view: `<svg width={n() * 10} height="10"><circle r={n()} cx="5" cy="5" /></svg>` },
  { id: "text-child", view: `<p>count: {n()} of {items().length}</p>` },
  { id: "nested-elements", view: `<ul><li><b>{n()}</b></li><li>{obj().label}</li></ul>` },
  { id: "fragment", view: `<>{n()}<span>{obj().label}</span></>` },
  { id: "list-map", view: `<ul>{items().map(x => <li>{x * n()}</li>)}</ul>` },
  { id: "conditional-and", view: `<div>{n() > 1 && <b>big</b>}</div>` },
  { id: "conditional-ternary", view: `<div>{n() > 1 ? <b>big</b> : <i>small</i>}</div>` },
  { id: "nullish-child", view: `<div>{maybe() ?? "none"}</div>` },
  {
    id: "store-children",
    view: `<ul>{store.list.map(t => <li class={t.done ? "done" : ""}>{t.title}</li>)}</ul>`
  },
  {
    id: "show",
    view: `<Show when={n() > 1} fallback={<p>small</p>}><p>big {n()}</p></Show>`,
    imports: "Show"
  },
  {
    id: "show-keyed-callback",
    view: `<Show when={maybe()}>{value => <p>{value()}</p>}</Show>`,
    imports: "Show"
  },
  {
    id: "for",
    view: `<ul><For each={items()}>{(x, i) => <li>{i()}: {x * n()}</li>}</For></ul>`,
    imports: "For"
  },
  {
    id: "for-store",
    view: `<ul><For each={store.list}>{t => <li>{t.title}</li>}</For></ul>`,
    imports: "For"
  },
  {
    id: "switch-match",
    view: `<Switch fallback={<p>none</p>}><Match when={n() === 1}><p>one</p></Match><Match when={n() > 1}><p>many</p></Match></Switch>`,
    imports: "Switch, Match"
  },
  {
    id: "repeat",
    view: `<ul><Repeat count={n()}>{i => <li>{i}</li>}</Repeat></ul>`,
    imports: "Repeat"
  },
  {
    id: "loading",
    view: `<Loading fallback={<p>…</p>}><p>{pending()}</p></Loading>`,
    imports: "Loading",
    extra: "pending"
  },
  {
    id: "errored",
    view: `<Errored fallback={(e, reset) => <button onClick={reset}>{String(e())}</button>}><p>{JSON.parse(String(n()))}</p></Errored>`,
    imports: "Errored"
  },
  {
    id: "component-props",
    view: `<Child value={n()} label={obj().label} />`,
    extra: "child"
  },
  {
    id: "component-children",
    view: `<Panel title={String(n())}><p>{obj().label}</p></Panel>`,
    extra: "panel"
  },
  {
    id: "component-getter-props",
    view: `<Child {...{ get value() { return n(); }, label: "x" }} />`,
    extra: "child"
  },
  {
    id: "event-click",
    view: `<button onClick={() => setN(n() + 1)}>{n()}</button>`
  },
  {
    id: "event-input",
    view: `<input value={String(n())} onInput={e => setN(Number(e.currentTarget.value))} />`
  },
  {
    id: "event-checkbox",
    view: `<input type="checkbox" checked={n() > 1} onChange={e => setN(e.currentTarget.checked ? 2 : 1)} />`
  },
  {
    id: "event-select",
    view: `<select value={String(n())} onChange={e => setN(Number(e.currentTarget.value))}><option value="1">1</option><option value="2">2</option></select>`
  },
  {
    id: "event-keyboard",
    view: `<input onKeyDown={e => { if (e.key === "Enter") setN(n() + 1); }} />`
  },
  {
    id: "event-named-handler",
    view: `<button onClick={increment}>{n()}</button>`,
    extra: "increment"
  },
  {
    id: "event-bound-data",
    view: `<button onClick={[(step: number) => setN(n() + step), 2]}>{n()}</button>`
  },
  {
    id: "ref-callback",
    view: `<input ref={el => el.focus()} value={String(n())} />`
  },
  {
    id: "ref-variable",
    view: `<input ref={input} onFocus={() => setN(input.value.length)} />`,
    extra: "ref"
  },
  // D-125: a component's return beyond one element; what it computes outside
  // its JSX is computed in the body (a read there is the body's)
  {
    id: "return-ternary",
    view: `n() > 1 ? <b>big</b> : <i>small</i>`,
    expected: ["READ_IN_SETUP"]
  },
  { id: "return-and", view: `n() > 1 && <b>big</b>`, expected: ["READ_IN_SETUP"] },
  { id: "return-array", view: `[<b>{n()}</b>, <i>{obj().label}</i>]` },
  { id: "return-string", view: `"plain text"` },
  // D-125 keeps D-041: JSX only as a view's, a hole's or a row's return
  {
    id: "jsx-helper",
    view: `<ul>{row("a")}</ul>`,
    extra: "row",
    expected: ["SUGAR_COMPONENT"]
  },
  {
    id: "jsx-in-body",
    view: `<div>{header}{n()}</div>`,
    extra: "header",
    expected: ["solid-yield/jsx-only-in-view"]
  },
  {
    id: "jsx-local-arrow",
    view: `<div>{badge()}</div>`,
    extra: "badge",
    expected: ["solid-yield/jsx-only-in-view"]
  },
  // contexts: a provider's accessor and action, read through a destructuring,
  // its members, a guard, in place, as a handler, as a tuple; a default; a
  // context called as a function (checked as its JSX form, review 3), with a
  // key that has no JSX form refused
  ...[
    ["context-destructured", "ctx-destructured"],
    ["context-members", "ctx-members"],
    ["context-guarded", "ctx-guarded"],
    ["context-in-place", "ctx-in-place"],
    ["context-handler-member", "ctx-handler-member"]
  ].map(([id, extra]) => ({
    id,
    view: `<Ctx value={{ count: n, bump: () => setN(n() + 1) }}><Consumer /></Ctx>`,
    extra,
    imports: "createContext, useContext"
  })),
  {
    id: "context-tuple",
    view: `<Pair value={[n, { bump: () => setN(n() + 1) }]}><Consumer /></Pair>`,
    extra: "ctx-tuple",
    imports: "createContext, useContext"
  },
  {
    id: "context-getter",
    view: `<Ctx value={{ get count() { return n(); } }}><Consumer /></Ctx>`,
    extra: "ctx-getter",
    imports: "createContext, useContext"
  },
  {
    // destructured, Solid reads the getter once in the body
    id: "context-getter-destructured",
    view: `<Ctx value={{ get count() { return n(); } }}><Consumer /></Ctx>`,
    extra: "ctx-getter-destructured",
    imports: "createContext, useContext",
    expected: ["READ_IN_SETUP"]
  },
  {
    id: "context-store",
    view: `<Ctx value={[store, { rename: (name: string) => setStore(s => { s.user.name = name; }) }]}><Consumer /></Ctx>`,
    extra: "ctx-store",
    imports: "createContext, useContext"
  },
  {
    id: "context-default",
    view: `<div><Consumer /><Theme value="dark"><Consumer /></Theme></div>`,
    extra: "ctx-theme",
    imports: "createContext, useContext"
  },
  {
    id: "context-call",
    view: `<div>{Theme({ value: "dark", children: () => <Consumer /> })}</div>`,
    extra: "ctx-theme",
    imports: "createContext, useContext"
  },
  {
    id: "context-call-computed",
    view: `<div>{Theme({ value: n() > 1 ? "dark" : "light", children: () => <Consumer /> })}</div>`,
    extra: "ctx-theme",
    imports: "createContext, useContext"
  },
  {
    id: "context-call-computed-key",
    view: `<div>{Theme({ ["value"]: "dark", children: () => <Consumer /> })}</div>`,
    extra: "ctx-theme",
    imports: "createContext, useContext",
    expected: ["NATIVE_CONTEXT"]
  },
  // what a view still may not do
  { id: "write-in-hole", view: `<p>{String(setN(1))}</p>`, expected: ["WRITE_IN_REACTIVE"] },
  {
    id: "create-in-hole",
    view: `<p>{String(createSignal(1)[0]())}</p>`,
    expected: ["CREATE_OUTSIDE_SETUP"]
  }
];
