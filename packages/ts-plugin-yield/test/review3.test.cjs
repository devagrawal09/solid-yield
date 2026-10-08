const test = require("node:test");
const assert = require("node:assert/strict");
const { makeService, root, ts } = require("./helpers.cjs");
const { join } = require("node:path");
const { diagnosticSpan } = require("../src/service.cjs");
test("review 3: Promise.all keeps tuple values and unions different member failures", () => {
  const source = `import {createMemo,Loading} from 'solid-js';import {render} from '@solidjs/web';
class Left extends Error{};class Right extends Error{};
async function left(){if(Math.random())throw new Left();return 1}
async function right(){if(Math.random())throw new Right();return 'ok'}
export function App(){const pair=createMemo(()=>Promise.all([left(),right()]));return <Loading fallback='wait'><p>{pair()[0].toFixed(2)}{pair()[1].toUpperCase()}</p></Loading>}
render(()=> <App/>,document.body);`;
  const { service } = makeService({ "app.tsx": source });
  try {
    const ds = service.diagnostics(join(root, "app.tsx"));
    assert.ok(
      ds.some(
        d =>
          d.messageText.includes("[FOREIGN_HANDOFF]") &&
          /Left/.test(d.messageText) &&
          /Right/.test(d.messageText)
      )
    );
    assert.ok(
      ds.every(d => d.messageText.includes("[FOREIGN_HANDOFF]")),
      JSON.stringify(ds.map(d => d.messageText))
    );
  } finally {
    service.dispose();
  }
});
test("review 3: an event Promise.catch handles the chain rejection", () => {
  const source = `class Bad extends Error{};async function risk(){throw new Bad()}export function App(){return <button onClick={()=>{risk().then(()=>1).catch(()=>0)}}/>}`;
  const { service } = makeService({ "app.tsx": source });
  try {
    assert.deepEqual(service.diagnostics(join(root, "app.tsx")), []);
  } finally {
    service.dispose();
  }
});
test("review 3: an async memo without await still has a pending result", () => {
  const source = `import {createMemo} from 'solid-js';import {render} from '@solidjs/web';export function App(){const n=createMemo(async()=>1);return <p>{n()}</p>};render(()=> <App/>,document.body)`;
  const { service } = makeService({ "app.tsx": source });
  try {
    assert.ok(
      service
        .diagnostics(join(root, "app.tsx"))
        .some(d => d.messageText.startsWith("[PENDING_ROOT]"))
    );
  } finally {
    service.dispose();
  }
});
test("review 3: invalid refusal coordinates fall back to a routine without crashing", () => {
  const file = ts.createSourceFile(
    "Clock.tsx",
    "function Clock() {\n  return <p>tick</p>;\n}",
    ts.ScriptTarget.Latest,
    true
  );
  for (const [line, column] of [
    [2, 10000],
    [-3, -5],
    [NaN, Infinity]
  ]) {
    const span = diagnosticSpan(ts, file, { line, column });
    assert.equal(span.generated, true);
    assert.ok(span.start >= 0 && span.start + span.length <= file.text.length);
  }
});
test("review 3: a lowercase JSX tag has no variable binding", () => {
  const source =
    'import {createMemo} from "solid-js"; export function Details(){ const p=createMemo(()=>1); return <p>{p()}</p>; }';
  const { service } = makeService({ "Details.tsx": source });
  try {
    assert.deepEqual(service.diagnostics(join(root, "Details.tsx")), []);
  } finally {
    service.dispose();
  }
});
test("review 3: refusal spans stay inside empty files and the end of a file", () => {
  for (const source of ["", "function Clock() { return <p/>; }"]) {
    const file = ts.createSourceFile("Clock.tsx", source, ts.ScriptTarget.Latest, true);
    for (const origin of [undefined, { sourceStart: source.length, sourceEnd: source.length }]) {
      const span = diagnosticSpan(ts, file, { line: 1, column: source.length + 1 }, origin);
      assert.ok(span.start >= 0 && span.start + span.length <= source.length);
      if (!origin) assert.equal(span.generated, true);
    }
  }
});
test("review 3: parse error names its own file", () => {
  const { service } = makeService({
    "Checkout.tsx": "export function Checkout(){return <p/>}",
    "ProductList.tsx": "export function ProductList(){ return <p>{yield}</p> }"
  });
  try {
    const ds = service.diagnostics(join(root, "ProductList.tsx"));
    assert.ok(ds.some(d => d.messageText.includes("[BABEL_PARSE_ERROR]")));
    assert.ok(ds.every(d => d.file.fileName.endsWith("ProductList.tsx")));
    assert.deepEqual(service.diagnostics(join(root, "Checkout.tsx")), []);
  } finally {
    service.dispose();
  }
});

const fs = require("node:fs");
const fixture = join(root, "review3-app");
const baseline = Object.fromEntries(
  fs
    .readdirSync(join(fixture, "src"))
    .map(file => [file, fs.readFileSync(join(fixture, "src", file), "utf8")])
);
const allDiagnostics = (service, files) =>
  Object.keys(files).flatMap(file => service.diagnostics(join(root, file)));
const hover = (service, files, file, name) =>
  service
    .quickInfo(join(root, file), files[file].indexOf(`function ${name}`) + 9)
    ?.displayParts.map(p => p.text)
    .join("");
for (const c of require("./fixtures/review3-app/expectations.json"))
  test(`review 3 mistake ${c.case}: ${c.mistake}`, () => {
    const files = { ...baseline, ...require(join(fixture, "cases", c.case)) };
    const { service } = makeService(files);
    try {
      const ds = allDiagnostics(service, files);
      if (c.code) {
        const d = ds.find(d => d.messageText.startsWith(`[${c.code}]`));
        assert.ok(d, JSON.stringify(ds.map(d => d.messageText)));
        assert.equal(d.file.fileName, join(root, c.file));
        assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, c.line);
      } else assert.deepEqual(ds, [], c.case);
      for (const d of ds) assert.doesNotMatch(d.messageText, /__native|import\("solid-yield"\)/);
      const details = hover(service, files, "Details.tsx", "Details");
      const list = hover(service, files, "ProductList.tsx", "ProductList");
      if (["03.json", "04.json"].includes(c.case)) {
        assert.match(list, /transport failure/);
        assert.doesNotMatch(list, /RateLimited|unknown/);
      }
      if (c.case === "05.json") {
        assert.match(ds[0].messageText, /transport failure/);
        assert.doesNotMatch(ds[0].messageText, /RateLimited/);
      }
      if (["11.json", "13.json"].includes(c.case)) {
        assert.match(details, /NotFound/);
        assert.doesNotMatch(details, /unknown/);
      }
      if (c.case === "10.json") assert.match(details, /Banned.*NotFound/);
      if (c.case === "09.json")
        assert.match(hover(service, files, "Clock.tsx", "Clock"), /can fail with Error/);
      if (c.case === "08.json")
        assert.match(hover(service, files, "Clock.tsx", "Clock"), /never fails/);
    } finally {
      service.dispose();
    }
  });
test("review 3: helpers calling built-ins are clean; use pure removes an opaque helper failure", () => {
  const files = {
    ...baseline,
    "Details.tsx": baseline["Details.tsx"].replace("{prod().price}", "{money(prod().price)}")
  };
  let { service } = makeService(files);
  try {
    assert.deepEqual(allDiagnostics(service, files), []);
    assert.doesNotMatch(hover(service, files, "Details.tsx", "Details"), /unknown|can wait/);
  } finally {
    service.dispose();
  }
  files["format.ts"] =
    "declare function opaque(): string;\nexport function money(n:number){ return opaque(); }";
  ({ service } = makeService(files));
  try {
    assert.match(hover(service, files, "Details.tsx", "Details"), /unknown/);
  } finally {
    service.dispose();
  }
  files["format.ts"] = '"use pure";\n' + files["format.ts"];
  ({ service } = makeService(files));
  try {
    assert.deepEqual(allDiagnostics(service, files), []);
    assert.doesNotMatch(hover(service, files, "Details.tsx", "Details"), /unknown/);
  } finally {
    service.dispose();
  }
});
test("review 3: removing use server removes only the transport failure", () => {
  const files = { ...baseline };
  for (const server of [true, false]) {
    files["api.ts"] = server ? baseline["api.ts"] : baseline["api.ts"].replace('"use server";', "");
    const { service } = makeService(files);
    try {
      const text = hover(service, files, "Details.tsx", "Details");
      assert.match(text, /NotFound/);
      assert.equal(text.includes("transport failure"), server);
      assert.doesNotMatch(text, /__native|import\("solid-yield"\)/);
    } finally {
      service.dispose();
    }
  }
});
for (const form of ["solid2-jsx", "provider-member", "solid2-call"])
  test(`review 3: provider wrapper ${form} discharges CartCtx`, () => {
    const files = { ...baseline };
    const returned =
      form === "provider-member"
        ? "<CartCtx.Provider value={cart}>{props.children}</CartCtx.Provider>"
        : form === "solid2-call"
          ? "CartCtx({value:cart,children:props.children})"
          : "<CartCtx value={cart}>{props.children}</CartCtx>";
    files["cart.tsx"] +=
      `\nimport type {JSX} from '@solidjs/web';\nexport function CartProvider(props:{children:JSX.Element}) { const cart=makeCart(); return ${returned}; }`;
    files["index.tsx"] = files["index.tsx"]
      .replace("{ CartCtx, makeCart }", "{ CartCtx, makeCart, CartProvider }")
      .replace("<CartCtx value={cart}>", "<CartProvider>")
      .replace("</CartCtx>", "</CartProvider>");
    const { service } = makeService(files);
    try {
      assert.deepEqual(allDiagnostics(service, files), []);
      assert.doesNotMatch(hover(service, files, "index.tsx", "App"), /needs CartCtx/);
      assert.ok(
        service
          .refresh()
          .inference[0].functions.find(f => f.name === "CartProvider")
          .provides.some(c => c.endsWith("#CartCtx"))
      );
    } finally {
      service.dispose();
    }
  });
test("review 3: provider wrapper retains other contexts and its children failures", () => {
  const files = {
    "cart.tsx": `import {createContext} from 'solid-js';import type {JSX} from '@solidjs/web';export const Ctx=createContext<string>();export const Other=createContext<string>();export function ThemeProvider(props:{children:JSX.Element}) {return <Ctx value='dark'>{props.children}</Ctx>}`,
    "index.tsx": `import {createMemo,useContext,Loading} from 'solid-js';import {render} from '@solidjs/web';import {Ctx,Other,ThemeProvider} from './cart';class Missing extends Error{};function Child(){const a=useContext(Ctx),b=useContext(Other);const x=createMemo(()=>{throw new Missing()});return <p>{a}{b}{x()}</p>};export function App(){return <Loading fallback='wait'><ThemeProvider><Child/></ThemeProvider></Loading>};render(()=> <App/>,document.body);`
  };
  const { service } = makeService(files);
  try {
    const ds = allDiagnostics(service, files);
    assert.ok(
      ds.some(d => d.messageText.startsWith("[NO_PROVIDER]") && d.messageText.includes("Other"))
    );
    assert.ok(
      ds.some(
        d => d.messageText.startsWith("[FOREIGN_HANDOFF]") && d.messageText.includes("Missing")
      )
    );
    assert.ok(
      ds
        .filter(d => d.messageText.startsWith("[NO_PROVIDER]"))
        .every(d => !d.messageText.includes("Missing: Ctx"))
    );
  } finally {
    service.dispose();
  }
});
test("review 3: an unknown callback refusal points to the read and preserves unrelated hovers", () => {
  const source = `import {createSignal} from 'solid-js';
declare function opaque(callback:()=>number):void;
export function Refused(){const [count]=createSignal(0);
opaque(()=>count());
return <p/>;}`;
  const files = { ...baseline, "Refused.tsx": source };
  const { service } = makeService(files);
  try {
    const ds = service.diagnostics(join(root, "Refused.tsx"));
    const d = ds.find(d => d.messageText.includes("[SUGAR_CALLBACK]"));
    assert.ok(d);
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 4);
    assert.equal(source.slice(d.start, d.start + d.length), "count()");
    assert.match(hover(service, files, "Details.tsx", "Details"), /NotFound/);
  } finally {
    service.dispose();
  }
});
for (const kind of ["event", "memo", "setup"])
  test(`review 3: an ignored then chain reports on its ${kind} host`, () => {
    const expression = "risk().then(()=>1);";
    const body =
      kind === "event"
        ? `return <button onClick={()=>{${expression}}}/>`
        : kind === "memo"
          ? `const n=createMemo(()=>{${expression}return 1});return <Loading fallback='wait'>{n()}</Loading>`
          : `${expression}return <p/>`;
    const source = `import {createMemo,Loading} from 'solid-js';\nimport {render} from '@solidjs/web';\nclass Bad extends Error{};async function risk(){throw new Bad()}\nexport function App(){${body}}\nrender(()=> <App/>,document.body);`;
    const { service } = makeService({ "app.tsx": source });
    try {
      const code =
        kind === "event"
          ? "EVENT_REJECTS"
          : kind === "memo"
            ? "FOREIGN_HANDOFF"
            : "NATIVE_SETUP_FAILURE";
      const ds = service.diagnostics(join(root, "app.tsx"));
      const d = ds.find(d => d.messageText.includes(`[${code}]`));
      assert.ok(d, JSON.stringify(ds.map(d => d.messageText)));
      assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 4);
      assert.ok(ds.every(d => !d.messageText.includes("SUGAR_")));
      if (kind !== "setup") assert.match(d.messageText, /Bad/);
    } finally {
      service.dispose();
    }
  });
test("review 3: a timer rejection belongs to its lexical event and requires an inner catch", () => {
  const source = `import {render} from '@solidjs/web';\nclass Bad extends Error{};\nexport function App(){return <button onClick={()=>{try{setTimeout(()=>{throw new Bad()},0)}catch(e){return 1}}}/>}\nrender(()=> <App/>,document.body);`;
  const { service } = makeService({ "app.tsx": source });
  try {
    const ds = service.diagnostics(join(root, "app.tsx"));
    const d = ds.find(d => d.messageText.startsWith("[EVENT_REJECTS]"));
    assert.ok(d);
    assert.match(d.messageText, /timer.*Bad.*inside the timer callback/);
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 3);
  } finally {
    service.dispose();
  }
});
for (const kind of ["named", "inline"])
  test(`review 3: ${kind} signal read and write in a JSX event`, () => {
    const source = `import {createSignal} from 'solid-js';export function App(){const [n,set]=createSignal(0);${kind === "named" ? "const add=()=>set(n()+1);" : ""}return <button onClick={${kind === "named" ? "add" : "()=>set(n()+1)"}}/>}`;
    const { service } = makeService({ "app.tsx": source });
    try {
      assert.deepEqual(service.diagnostics(join(root, "app.tsx")), []);
    } finally {
      service.dispose();
    }
  });
