import { Linter, RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import plugin, { rules, REFUSALS } from "../src/index.js";
import { relative } from "node:path";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
    ecmaVersion: 2024,
    sourceType: "module"
  }
});

const component = body => `const C = component(function* () { ${body} });`;

tester.run("no-throw", rules["no-throw"], {
  valid: [
    component("return view(function* () { return <p />; });"),
    "function* notARoutine() { throw new Error('x'); }",
    component(
      "const f = () => { throw new Error('plain callback'); }; return view(function* () { return <p />; });"
    ),
    "const m = $memo(function* () { try { return 1; } catch (e) { return 2; } });"
  ],
  invalid: [
    {
      code: "const m = $memo(function* () { throw new Error('x'); });",
      errors: [{ messageId: "throw" }]
    },
    {
      code: "const e = $event(function* () { if (x) throw y; });",
      errors: [{ messageId: "throw" }]
    },
    {
      code: component("return view(function* () { throw new Error('view'); });"),
      errors: [{ messageId: "throw" }]
    },
    {
      code: "const r = <For each={xs}>{function* (x) { throw x; }}</For>;",
      errors: [{ messageId: "throw" }]
    }
  ]
});

tester.run("no-read-in-view-body", rules["no-read-in-view-body"], {
  valid: [
    component(
      "const [n] = yield* $signal(1); return view(function* () { return <p class={{ a: (yield* n) > 1 }}>{yield* n}</p>; });"
    ),
    component("return view(function* () { return <section>{yield* Child({})}</section>; });"),
    "const m = $memo(function* () { const v = yield* n; return v; });",
    // a row's setup is not its view (its reads are READ_IN_SETUP's, a type error)
    "const r = <For each={xs}>{function* (x) { const d = yield* $memo(function* () { return yield* x.a; }); return view(function* () { return <i>{yield* d}</i>; }); }}</For>;",
    // h: an h view (no JSX) is held by its type, [HVIEW_READ], not the lint (D-049)
    component(
      "const [n] = yield* $signal(1); return view(function* () { return h('p', String(yield* n)); });"
    ),
    component(
      "return view(function* () { return For({ each: xs, children: function* (x) { return function* () { return h('li', yield* x.a); }; } }); });"
    ),
    // h: the reads are in bare function* holes
    component(
      "const [n] = yield* $signal(1); return view(function* () { return h('p', { class: function* () { return (yield* n) > 1 ? 'big' : ''; } }, n, function* () { return (yield* n) * 2; }); });"
    ),
    component(
      "return view(function* () { return For({ each: xs, children: function* (x) { return function* () { return h('li', function* () { return yield* x.a; }); }; } }); });"
    )
  ],
  invalid: [
    {
      code: component(
        "const [n] = yield* $signal(1); return view(function* () { const v = yield* n; return <p>{v}</p>; });"
      ),
      errors: [{ messageId: "read" }]
    },
    {
      // a component call's zero-arity children are a lazy view (D-066): no body reads
      code: component(
        "return view(function* () { return <>{yield* Show({ when: n, children: function* () { const v = yield* n; return <b>{v}</b>; } })}</>; });"
      ),
      errors: [{ messageId: "read" }]
    },
    {
      // a branch on a read: structure comes from flow controls
      code: "const r = <For each={xs}>{function* (x) { return view(function* () { if (yield* x.done) return <i />; return <b />; }); }}</For>;",
      errors: [{ messageId: "read" }]
    },
    {
      code: component(
        "return view(function* () { const c = yield* Child({}); return <div>{c}</div>; });"
      ),
      errors: [{ messageId: "child" }]
    },
    {
      // a setup returning one of two views, and a row bound to a const in the setup
      code: component(
        "const row = function* (x) { return view(function* () { const t = yield* x; return <li>{t}</li>; }); }; return mode ? function* () { return <p>{String(yield* n)}</p>; } : function* () { const v = yield* n; return <i>{v}</i>; };"
      ),
      errors: [{ messageId: "read" }, { messageId: "read" }]
    }
  ]
});

tester.run("no-dollar-block", rules["no-dollar-block"], {
  valid: [
    component(
      "const d = yield* $memo(function* () { return 1; }); return view(function* () { return <p>{yield* d}</p>; });"
    ),
    // a `$` that is not the library's (a test helper, jQuery)
    "const $ = s => document.querySelector(s); $('p');",
    "import { $ } from 'jquery'; $('p');"
  ],
  invalid: [
    {
      // a derivation in a setup becomes the setup's $memo; the import follows
      code:
        'import { $, component } from "solid-yield";\n' +
        component(
          "const d = $(function* () { return 1; }); return view(function* () { return <p>{yield* d}</p>; });"
        ),
      output:
        'import { $memo, component } from "solid-yield";\n' +
        component(
          "const d = yield* $memo(function* () { return 1; }); return view(function* () { return <p>{yield* d}</p>; });"
        ),
      errors: [{ messageId: "import" }, { messageId: "derived" }]
    },
    {
      // in a row's setup too (D-030)
      code: "const r = <For each={xs}>{function* (x) { const s = $(function* () { return yield* x.a; }); return view(function* () { return <i>{yield* s}</i>; }); }}</For>;",
      output:
        "const r = <For each={xs}>{function* (x) { const s = yield* $memo(function* () { return yield* x.a; }); return view(function* () { return <i>{yield* s}</i>; }); }}</For>;",
      errors: [{ messageId: "derived" }]
    },
    {
      // no-JSX holes: an `h` child, an attribute value, a flow control's source prop
      code: "const v = h('p', { class: $(function* () { return 'a'; }) }, $(function* () { return 1; }), Show({ when: $(function* () { return true; }), children: 'x' }));",
      output:
        "const v = h('p', { class: function* () { return 'a'; } }, function* () { return 1; }, Show({ when: function* () { return true; }, children: 'x' }));",
      errors: [{ messageId: "hole" }, { messageId: "hole" }, { messageId: "hole" }]
    },
    {
      // `html` is removed (D-046): a value in a tagged template is no hole of `h`
      code: "const v = html`<p>${$(function* () { return 1; })}</p>`;",
      output: null,
      errors: [{ messageId: "other" }]
    },
    {
      // rows: `$(function* (item) …)` and `$scope(fn)` are the bare function*
      code: 'import { $, $scope, For } from "solid-yield";\nconst a = <For each={xs}>{$(function* (x) { return view(function* () { return <i />; }); })}</For>;\nconst b = <For each={xs}>{$scope(row)}</For>;',
      output:
        'import { For } from "solid-yield";\nconst a = <For each={xs}>{function* (x) { return view(function* () { return <i />; }); }}</For>;\nconst b = <For each={xs}>{row}</For>;',
      errors: [
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "row" },
        { messageId: "row" }
      ]
    },
    {
      // no fix where no form is equivalent: a module-level source, a JSX child
      code: 'import { $ } from "solid-yield";\nconst NOBODY = $(function* () { return null; });',
      output: null,
      errors: [{ messageId: "import" }, { messageId: "other" }]
    },
    {
      code: component(
        "return view(function* () { return <p>{$(function* () { return 1; })}</p>; });"
      ),
      output: null,
      errors: [{ messageId: "other" }]
    }
  ]
});

tester.run("no-path-object-use", rules["no-path-object-use"], {
  valid: [
    // reads compare and spread values
    component(
      "const [s] = yield* $store({ a: { b: 1 } }); const m = yield* $memo(function* () { return { ...(yield* s.a) }; }); return view(function* () { return <p title={JSON.stringify(yield* s.a)}>{(yield* s.a.b) === 1 ? 'one' : ''}</p>; });"
    ),
    // passing a path on is fine; so is spreading the props object (not a path)
    "const C = component(function* (props) { return view(function* () { return <Child {...props} user={props.user} />; }); });",
    // a plain object with the same shape is not a path
    "const s = { a: 1 }; const t = { ...s }; s.a === 1;"
  ],
  invalid: [
    {
      code: "const C = component(function* (props) { const m = yield* $memo(function* () { return { ...props.user }; }); return view(function* () { return <p />; }); });",
      errors: [{ messageId: "spread" }]
    },
    {
      code: component(
        "const [s] = yield* $store({ a: 1 }); const m = yield* $memo(function* () { return s.a === 1; }); return view(function* () { return <p {...s} />; });"
      ),
      errors: [{ messageId: "compare" }, { messageId: "spread" }]
    },
    {
      code: "const r = <For each={xs}>{function* (x) { return view(function* () { return <i>{JSON.stringify(x)}</i>; }); }}</For>;",
      errors: [{ messageId: "stringify" }]
    },
    {
      code: component(
        "const p = yield* $projection(function* (d) {}, { a: [1] }); const m = yield* $memo(function* () { return p.a[0] !== undefined; }); return view(function* () { return <p />; });"
      ),
      errors: [{ messageId: "compare" }]
    }
  ]
});

tester.run("require-view-wrapper", rules["require-view-wrapper"], {
  valid: [
    component("return view(function* () { return <p />; });"),
    "const r = <For each={xs}>{function* (x) { return view(function* () { return <i />; }); }}</For>;"
  ],
  invalid: [
    {
      code:
        'import { component } from "solid-yield";\n' +
        component("return function* () { return <p />; };"),
      output:
        'import { component, view } from "solid-yield";\n' +
        component("return view(function* () { return <p />; });"),
      errors: [{ messageId: "wrap" }]
    },
    {
      // a row's view too, and an h view
      code: "const r = <For each={xs}>{function* (x) { return function* () { return h('i'); }; }}</For>;",
      output:
        "const r = <For each={xs}>{function* (x) { return view(function* () { return h('i'); }); }}</For>;",
      errors: [{ messageId: "wrap" }]
    }
  ]
});

tester.run("no-read-in-view-body (a wrapped view)", rules["no-read-in-view-body"], {
  valid: [component("return view(function* () { return <p>{yield* n}</p>; });")],
  invalid: [
    {
      code: component("return view(function* () { const v = yield* n; return <p>{v}</p>; });"),
      errors: [{ messageId: "read" }]
    }
  ]
});

tester.run("jsx-only-in-view", rules["jsx-only-in-view"], {
  valid: [
    component("return view(function* () { return <p>{yield* n}</p>; });"),
    // a component call's zero-arity children / fallback are lazy views (D-066)
    component(
      "return view(function* () { return <>{yield* Show({ when: n, fallback: function* () { return <i />; }, children: function* () { return <b />; } })}</>; });"
    ),
    // a render callback inside a view's JSX builds elements: fine
    component(
      "return view(function* () { return <Router>{props => <Loading>{props.children}</Loading>}</Router>; });"
    ),
    // a row's view
    "const r = <For each={xs}>{function* (x) { return view(function* () { return <li />; }); }}</For>;",
    // plain code outside routines
    "const el = () => <p />;"
  ],
  invalid: [
    {
      code: component(
        "const header = <h1>{yield* title}</h1>; return view(function* () { return header; });"
      ),
      errors: [{ messageId: "jsx", data: { where: "a setup" } }]
    },
    {
      // a plain function declared in the setup is the setup's code
      code: component("const make = () => <h1 />; return view(function* () { return <p />; });"),
      errors: [{ messageId: "jsx", data: { where: "a setup" } }]
    },
    {
      code: "const r = <For each={xs}>{function* (x) { const el = <i />; return view(function* () { return el; }); }}</For>;",
      errors: [{ messageId: "jsx", data: { where: "a row's setup" } }]
    },
    {
      code: "const m = $memo(function* () { return <p />; });",
      errors: [{ messageId: "jsx", data: { where: "a $memo" } }]
    }
  ]
});

const imports = 'import { component, Show, For, Loading, view } from "solid-yield";\n';
const Card =
  "const Card = component(function* (props) { return view(function* () { return <p />; }); });\n";

tester.run("no-component-tag", rules["no-component-tag"], {
  valid: [
    // DOM elements and foreign (plain-Solid) components stay tags (D-067)
    imports +
      component("return view(function* () { return <div><Router>{p => <i />}</Router></div>; });"),
    'import { Router } from "@solidjs/router";\nconst x = <Router />;',
    // a call is fine
    imports +
      Card +
      component("return view(function* () { return <ul>{yield* Card({ a: 1 })}</ul>; });")
  ],
  invalid: [
    {
      // a yield component tag: props as values / sources / holes, children a lazy view
      code:
        imports +
        Card +
        component(
          'return view(function* () { return <ul><Card a={x} b="s" c={yield* n} d={(yield* n) + 1} flag><b>{yield* n}</b></Card></ul>; });'
        ),
      output:
        imports +
        Card +
        component(
          'return view(function* () { return <ul>{yield* Card({ a: x, b: "s", c: n, d: function* () {\nreturn (yield* n) + 1;\n}, flag: true, children: function* () {\nreturn <b>{yield* n}</b>;\n} })}</ul>; });'
        ),
      errors: [{ messageId: "tag" }]
    },
    {
      // a flow control returned by the view: a fragment hole; a render arrow becomes a row
      code:
        imports +
        component("return view(function* () { return <For each={xs}>{x => <li />}</For>; });"),
      output:
        imports +
        component(
          "return view(function* () { return <>{yield* For({ each: xs, children: function* (x) {\nreturn view(function* () {\nreturn <li />;\n});\n} })}</>; });"
        ),
      errors: [{ messageId: "tag" }]
    },
    {
      // a tag given as a prop was built when the prop was read: a lazy view
      code:
        imports +
        Card +
        component(
          "return view(function* () { return <>{yield* Show({ when: x, fallback: <Card a={1} />, children: function* () { return <i />; } })}</>; });"
        ),
      output:
        imports +
        Card +
        component(
          "return view(function* () { return <>{yield* Show({ when: x, fallback: function* () {\nreturn <>{yield* Card({ a: 1 })}</>;\n}, children: function* () { return <i />; } })}</>; });"
        ),
      errors: [{ messageId: "tag" }]
    },
    {
      // outside a routine (a root, a test) it is the plain call
      code: imports + "const f = () => <Show when={x}><i /></Show>;",
      output:
        imports + "const f = () => Show({ when: x, children: function* () {\nreturn <i />;\n} });",
      errors: [{ messageId: "tag" }]
    }
  ]
});

tester.run("no-read-in-prop", rules["no-read-in-prop"], {
  valid: [
    imports +
      Card +
      component(
        "return view(function* () { return <ul>{yield* Card({ a: n, b: function* () { return yield* n; } })}</ul>; });"
      ),
    // a JSX hole inside a prop's element is that element's own
    imports +
      component(
        "return view(function* () { return <ul>{yield* Show({ when: x, fallback: <i>{yield* n}</i>, children: function* () { return <b />; } })}</ul>; });"
      ),
    // an event's call is not a component call
    "const e = $event(function* () { yield* save({ id: yield* props.id }); });"
  ],
  invalid: [
    {
      code:
        imports +
        Card +
        component(
          "return view(function* () { return <ul>{yield* Card({ a: yield* n, b: (yield* n) * 2 })}</ul>; });"
        ),
      output:
        imports +
        Card +
        component(
          "return view(function* () { return <ul>{yield* Card({ a: n, b: function* () {\nreturn (yield* n) * 2;\n} })}</ul>; });"
        ),
      errors: [{ messageId: "read" }, { messageId: "read" }]
    }
  ]
});

tester.run("component-children-generator", rules["component-children-generator"], {
  valid: [
    imports +
      component(
        "return view(function* () { return <ul>{yield* Show({ when: x, children: function* () { return <b />; } })}</ul>; });"
      ),
    imports +
      component(
        "return view(function* () { return <ul>{yield* For({ each: xs, children: function* (x) { return view(function* () { return <li />; }); } })}</ul>; });"
      ),
    // h output in a no-JSX file is built where it is inserted
    { code: imports + "const v = Show({ when: x, children: h('b') });", filename: "app.ts" },
    // D-092: a lazy-view fallback, text, a render function
    imports +
      component(
        "return view(function* () { return <>{yield* Loading({ fallback: function* () { return <i>…</i>; }, children: function* () { return <b />; } })}{yield* Show({ when: x, fallback: 'none', children: function* () { return <b />; } })}{yield* Errored({ fallback: (e) => <p>{String(e())}</p>, children: function* () { return <b />; } })}</>; });"
      ),
    // a yield component's own `fallback` prop is a value like any other
    imports +
      "const Card = component(function* (props) { return view(function* () { return <b />; }); });" +
      component("return view(function* () { return <>{yield* Card({ fallback: <i /> })}</>; });")
  ],
  invalid: [
    {
      filename: "app.tsx",
      code:
        imports +
        component(
          'return view(function* () { return <ul>{yield* Loading({ fallback: <span class="loader">…</span>, children: function* () { return <b />; } })}</ul>; });'
        ),
      output:
        imports +
        component(
          'return view(function* () { return <ul>{yield* Loading({ fallback: function* () {\nreturn <span class="loader">…</span>;\n}, children: function* () { return <b />; } })}</ul>; });'
        ),
      errors: [{ messageId: "fallback", data: { name: "Loading" } }]
    },
    {
      filename: "app.tsx",
      code:
        imports +
        component(
          "return view(function* () { return <>{yield* Errored({ fallback: <><p>failed</p></>, children: function* () { return <b />; } })}{yield* For({ each: xs, fallback: <p>none</p>, children: function* (x) { return view(function* () { return <li />; }); } })}</>; });"
        ),
      output:
        imports +
        component(
          "return view(function* () { return <>{yield* Errored({ fallback: function* () {\nreturn <><p>failed</p></>;\n}, children: function* () { return <b />; } })}{yield* For({ each: xs, fallback: function* () {\nreturn <p>none</p>;\n}, children: function* (x) { return view(function* () { return <li />; }); } })}</>; });"
        ),
      errors: [
        { messageId: "fallback", data: { name: "Errored" } },
        { messageId: "fallback", data: { name: "For" } }
      ]
    },
    {
      filename: "app.tsx",
      code:
        imports +
        component(
          "return view(function* () { return <ul>{yield* Loading({ fallback: 'x', children: () => Card({}) })}</ul>; });"
        ),
      output:
        imports +
        component(
          "return view(function* () { return <ul>{yield* Loading({ fallback: 'x', children: function* () {\nreturn <>{yield* Card({})}</>;\n} })}</ul>; });"
        ),
      errors: [{ messageId: "children" }]
    },
    {
      filename: "app.tsx",
      code:
        imports +
        component(
          "return view(function* () { return <ul>{yield* Show({ when: x, children: <b /> })}</ul>; });"
        ),
      output:
        imports +
        component(
          "return view(function* () { return <ul>{yield* Show({ when: x, children: function* () {\nreturn <b />;\n} })}</ul>; });"
        ),
      errors: [{ messageId: "children" }]
    }
  ]
});

tester.run("component-call-yielded", rules["component-call-yielded"], {
  valid: [
    imports +
      Card +
      component(
        "return view(function* () { return <>{yield* Card({})}{yield* Show({ when: x, children: function* () { return <b />; } })}</>; });"
      ),
    // a view's returned call is typed through its return
    imports +
      Card +
      component("return view(function* () { return Show({ when: x, children: h('b') }); });"),
    // an argument or a prop: typed by what takes it
    imports +
      Card +
      component(
        "return view(function* () { return h('div', Show({ when: x, children: h('b') })); });"
      ),
    imports +
      Card +
      component(
        "return view(function* () { return <>{yield* Loading({ fallback: Card({}), children: function* () { return <b />; } })}</>; });"
      ),
    // a call in a plain function: a root or foreign handoff
    imports +
      Card +
      "render(() => Errored({ fallback: 'x', children: function* () { return <>{yield* Card({})}</>; } }), root);",
    // a plain function or a lowercase call is not a yield component
    imports + Card + component("return view(function* () { return <>{format(x)}{Other()}</>; });"),
    // a conditional's test is not rendered
    imports + Card + component("return view(function* () { return <>{Card({}) ? 1 : 2}</>; });")
  ],
  invalid: [
    {
      code: imports + Card + component("return view(function* () { return <>{Card({})}</>; });"),
      output:
        imports + Card + component("return view(function* () { return <>{yield* Card({})}</>; });"),
      errors: [{ messageId: "unyielded" }]
    },
    {
      // the todos twin's shape (review R2): an array in a fragment
      code:
        imports +
        Card +
        component(
          "return view(function* () { return <>{[Card({ a: 1 }), Show({ when: x, children: function* () { return <b />; } })]}</>; });"
        ),
      output:
        imports +
        Card +
        component(
          "return view(function* () { return <>{[yield* Card({ a: 1 }), yield* Show({ when: x, children: function* () { return <b />; } })]}</>; });"
        ),
      errors: [{ messageId: "unyielded" }, { messageId: "unyielded" }]
    },
    {
      code:
        imports +
        Card +
        component("return view(function* () { return <div>{ok ? Card({}) : null}</div>; });"),
      output:
        imports +
        Card +
        component(
          "return view(function* () { return <div>{ok ? (yield* Card({})) : null}</div>; });"
        ),
      errors: [{ messageId: "unyielded" }]
    },
    {
      // a flow control imported from solid-yield
      code:
        imports +
        Card +
        component(
          "return view(function* () { return <ul>{Show({ when: x, children: function* () { return <b />; } })}</ul>; });"
        ),
      output:
        imports +
        Card +
        component(
          "return view(function* () { return <ul>{yield* Show({ when: x, children: function* () { return <b />; } })}</ul>; });"
        ),
      errors: [{ messageId: "unyielded" }]
    }
  ]
});

tester.run("read-before-attempt", rules["read-before-attempt"], {
  valid: [
    "const m = $memo(function* () { const id = yield* props.id; return yield* attempt(() => f(id)); });",
    "const m = $memo(function* () { const u = yield* attempt(() => f()); if (!u) yield* raise(new E()); return u; });",
    "const e = $event(function* () { yield* attempt(() => f()); const v = yield* n; });"
  ],
  invalid: [
    {
      code: "const m = $memo(function* () { const u = yield* attempt(() => f()); return u + (yield* n); });",
      errors: [{ messageId: "after" }]
    }
  ]
});

tester.run("no-unyielded-write", rules["no-unyielded-write"], {
  valid: [
    component(
      "const [n, setN] = yield* $signal(1); const inc = $event(function* () { yield* setN(2); }); yield* $effect(function* () {}, function* () { const v = yield* setN(3); }); return view(function* () { return <p onClick={yield* inc}>{yield* n}</p>; });"
    ),
    component(
      "const [s, setS] = yield* $optimisticStore({ a: 1 }); const go = $event(function* () { yield* setS(d => { d.a = 2; }); }); return view(function* () { return <p onClick={yield* go} />; });"
    ),
    // not a routine setter: plain code is no-foreign-reactive's concern
    "const [a, setA] = createSignal(1); setA(2);"
  ],
  invalid: [
    {
      code: component(
        "const [n, setN] = yield* $signal(1); const inc = $event(function* () { setN(2); }); return view(function* () { return <p onClick={yield* inc} />; });"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setN" } }]
    },
    {
      code: component(
        "const [s, setS] = yield* $store({ a: 1 }); setS(d => { d.a = 2; }); return view(function* () { return <p />; });"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setS" } }]
    },
    {
      code: component(
        "const [n, setN] = yield* $optimistic(1); const bump = () => setN(1); return view(function* () { return <p />; });"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setN" } }]
    },
    {
      code: component(
        "const [n, setN] = yield* $signal(1); const go = $event(function* () { yield setN(1); }); return view(function* () { return <p onClick={yield* go} />; });"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setN" } }]
    }
  ]
});

tester.run("no-foreign-reactive", rules["no-foreign-reactive"], {
  valid: [
    'import { $signal, $optimisticStore, until, refresh } from "solid-yield";',
    'import { lazy, createUniqueId, onCleanup } from "solid-js";',
    'import { query, useNavigate } from "@solidjs/router";',
    'import type { Accessor } from "solid-js";',
    'import { type Signal } from "solid-js";',
    // flush is not reactive state: a test calls it between two dispatched events
    'import { flush } from "solid-js"; it("t", async () => { flush(); await 0; flush(); });',
    'import { flush as commit } from "@solidjs/signals"; function settle() { commit(); }',
    // a plain function beside a component, not inside a routine
    'import { flush } from "solid-js"; const C = component(function* () { return view(function* () { return <p />; }); }); export const go = () => flush();'
  ],
  invalid: [
    {
      code: 'import { createSignal, createOptimisticStore } from "solid-js";',
      errors: [
        {
          messageId: "foreign",
          data: { name: "createSignal", source: "solid-js", hint: " Use `$signal`." }
        },
        {
          messageId: "foreign",
          data: {
            name: "createOptimisticStore",
            source: "solid-js",
            hint: " Use `$optimisticStore`."
          }
        }
      ]
    },
    {
      code: 'import { useLocation as loc } from "@solidjs/router";',
      errors: [{ messageId: "foreign" }]
    },
    {
      code: 'import { dynamic } from "@solidjs/web";',
      errors: [
        {
          messageId: "foreign",
          data: {
            name: "dynamic",
            source: "@solidjs/web",
            hint: " Use `Switch(…)` / `Show(…)` over the components."
          }
        }
      ]
    },
    {
      // no $untrack (D-083): a read is untracked where its host is
      code: 'import { untrack } from "solid-js";',
      errors: [
        {
          messageId: "foreign",
          data: {
            name: "untrack",
            source: "solid-js",
            hint: " Use a plain `yield*` where the host does not track: an `$event`, or an `$effect`'s effect phase."
          }
        }
      ]
    },
    {
      // in a routine: its writes commit when its transaction ends
      code: 'import { flush } from "solid-js"; const save = $event(function* () { yield* setA(1); flush(); });',
      errors: [{ messageId: "inRoutine", data: { name: "flush", source: "solid-js" } }]
    },
    {
      // at any depth of plain functions inside a routine; aliased
      code: `import { flush as commit } from "solid-js"; ${component(
        "const later = () => commit(); return view(function* () { return <p />; });"
      )}`,
      errors: [{ messageId: "inRoutine", data: { name: "flush", source: "solid-js" } }]
    }
  ]
});

// The guide's test file (getting-started's app-shell recipe), linted with the
// recommended config extended to tests: nothing is reported (its `flush`
// import is not reactive state; it is called outside routines).
describe("the getting-started test file under the recommended config", () => {
  it("reports nothing", () => {
    const guide = readFileSync(
      fileURLToPath(new URL("../../../documentation/getting-started.md", import.meta.url)),
      "utf8"
    );
    const block = /```tsx\n(\/\/ test\/app\.test\.tsx[^]*?)```/.exec(guide);
    expect(block).not.toBeNull();
    const source = block[1];
    expect(source).toContain('import { flush } from "solid-js";');
    const linter = new Linter({ configType: "flat" });
    const messages = linter.verify(
      source,
      [
        {
          files: ["**/*.tsx"],
          languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaFeatures: { jsx: true } }
          },
          plugins: { "solid-yield": plugin },
          rules: { ...plugin.configs.recommended.rules }
        }
      ],
      fileURLToPath(new URL("./fixtures/jsx-factory/app.test.tsx", import.meta.url))
    );
    expect(messages.map(m => `${m.ruleId}: ${m.message}`)).toEqual([]);
  });
});

// --- the lint's refusals ARE the transform's refusals --------------------------------------------------
// The rule's cases, pinned by vite-plugin-solid-yield (generated from the fork's Rust rule
// before D-043 removed it from the compiler).
const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../vite-plugin-yield/test/fixtures/rule.json", import.meta.url)),
    "utf8"
  )
);

tester.run("yield-in-jsx-hole", rules["yield-in-jsx-hole"], {
  valid: fixtures.accepted,
  invalid: fixtures.refused.map(({ code, source }) => ({
    code: source,
    errors: [{ messageId: code }]
  }))
});

describe("transform refusals and lint refusals are the same list", () => {
  it("the rule's codes are the shared list", () => {
    expect(Object.keys(REFUSALS).sort()).toEqual([...fixtures.refusals].sort());
  });

  // Every case: the transform throws code X exactly when the lint reports X.
  const cases = [...fixtures.accepted.map(source => ({ source, code: null })), ...fixtures.refused];
  for (const { source, code } of cases) {
    it(`${code ?? "accepted"}: ${source}`, async () => {
      const { transform } = await import("vite-plugin-solid-yield");
      let compiled = null;
      try {
        transform(source, { filename: "case.tsx" });
      } catch (e) {
        compiled = /\[((?:PLAIN_)?YIELD_IN_[A-Z_]+)\]/.exec(String(e.message))?.[1] ?? "OTHER";
      }
      const { Linter } = await import("eslint");
      const linter = new Linter({ configType: "flat" });
      const messages = linter.verify(source, {
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
          ecmaVersion: 2024,
          sourceType: "module"
        },
        plugins: { "solid-yield": { rules } },
        rules: { "solid-yield/yield-in-jsx-hole": "error" }
      });
      const linted = messages.length
        ? /\[((?:PLAIN_)?YIELD_IN_[A-Z_]+)\]/.exec(messages[0].message)?.[1]
        : null;
      expect(linted).toBe(code);
      expect(compiled).toBe(code);
    });
  }
});

// --- with type information -----------------------------------------------------------
const typedFixtures = fileURLToPath(new URL("./fixtures", import.meta.url));
const typedTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
      projectService: true,
      tsconfigRootDir: typedFixtures
    },
    ecmaVersion: 2024,
    sourceType: "module"
  }
});
const filename = `${typedFixtures}/file.tsx`;
const decls = `
interface Yieldable<Y, R> { [Symbol.iterator](): Generator<Y, R, any>; }
interface EventCall<R> extends Promise<R>, Yieldable<unknown, R> { readonly __call: true }
declare function $event<A extends unknown[]>(f: (...a: A) => Generator<unknown, unknown, unknown>): (...a: A) => EventCall<void>;
declare function attempt<T>(f: () => T): Yieldable<unknown, T>;
declare const actions: { save: (x: number) => EventCall<void> };
`;
typedTester.run("no-unyielded-write (with types)", rules["no-unyielded-write"], {
  valid: [
    {
      filename,
      code: decls + "const e = $event(function* () { yield* actions.save(1); });"
    },
    // plain code calls an event: it runs (a DOM dispatch, a timer, a callback)
    { filename, code: decls + "const e = $event(function* () {}); e();" },
    // a call kept for later is not discarded
    {
      filename,
      code: decls + "const e = $event(function* () { const call = actions.save(1); yield* call; });"
    }
  ],
  invalid: [
    {
      filename,
      code: decls + "const e = $event(function* () { actions.save(1); });",
      errors: [{ messageId: "eventCall" }]
    },
    {
      // start() is removed (D-035): a call it would have wrapped is a bare promise
      filename,
      code:
        decls +
        "declare function start(c: unknown): Yieldable<unknown, void>; const e = $event(function* () { yield* start(actions.save(2)); });",
      errors: [{ messageId: "eventCall" }]
    },
    {
      filename,
      code: decls + "const e = $event(function* () { void actions.save(1); });",
      errors: [{ messageId: "eventCall" }]
    },
    {
      filename,
      code: decls + "const e = $event(function* () { actions.save(1).catch(() => {}); });",
      errors: [{ messageId: "eventCall" }]
    },
    {
      filename,
      code: decls + "const e = $event(function* () { attempt(() => 1); });",
      errors: [{ messageId: "discarded" }]
    },
    {
      filename,
      code: decls + "function* helper() { yield 1; } const e = $event(function* () { helper(); });",
      errors: [{ messageId: "discarded" }]
    }
  ]
});

// a yield component is a function returning a view marked [COMPONENT] (D-067, D-068)
const componentDecls = `
declare const COMPONENT: unique symbol;
interface View<P extends boolean, E> { readonly __view: [P, E] }
type ComponentView<P extends boolean, E> = View<P, E> & { readonly [COMPONENT]: true };
declare const Card: (props: { title: string }) => ComponentView<false, never>;
declare const Through: <E, P extends boolean>(props: { todo: E }) => ComponentView<P, E>;
declare const Foreign: (props: { title: string }) => Node | string | null;
`;
typedTester.run("no-component-tag (with types)", rules["no-component-tag"], {
  valid: [
    { filename, code: componentDecls + 'const a = <Foreign title="t" />;' },
    { filename, code: componentDecls + 'const a = <div title="t" />;' }
  ],
  invalid: [
    {
      filename,
      code: componentDecls + 'function* v() { return <p><Card title="t" /></p>; }',
      output: componentDecls + 'function* v() { return <p>{yield* Card({ title: "t" })}</p>; }',
      errors: 1
    },
    {
      // a generic (pass-through) component keeps its type parameters and is still one
      filename,
      code: componentDecls + "function* v() { return <p><Through todo={1} /></p>; }",
      output: componentDecls + "function* v() { return <p>{yield* Through({ todo: 1 })}</p>; }",
      errors: 1
    }
  ]
});
typedTester.run("component-call-yielded (with types)", rules["component-call-yielded"], {
  valid: [
    {
      filename,
      code: componentDecls + 'function* v() { return <>{yield* Card({ title: "t" })}</>; }'
    },
    // a foreign component returns no view: calling it is plain code
    { filename, code: componentDecls + 'function* v() { return <>{Foreign({ title: "t" })}</>; }' }
  ],
  invalid: [
    {
      // an unyielded call in a fragment (review R2): its colors reach no type
      filename,
      code: componentDecls + 'function* v() { return <>{Card({ title: "t" })}</>; }',
      output: componentDecls + 'function* v() { return <>{yield* Card({ title: "t" })}</>; }',
      errors: 1
    },
    {
      filename,
      code: componentDecls + "function* v() { return <>{[Through({ todo: 1 })]}</>; }",
      output: componentDecls + "function* v() { return <>{[yield* Through({ todo: 1 })]}</>; }",
      errors: 1
    }
  ]
});

// --- no-unbound-event (D-072) ---------------------------------------------------------
const evt = "const save = $event(function* () {});";
tester.run("no-unbound-event", rules["no-unbound-event"], {
  valid: [
    component(`${evt} return view(function* () { return <b onClick={yield* save} />; });`),
    component(`${evt} return view(function* () { return <b on:click={yield* save} />; });`),
    component(`${evt} return view(function* () { return <b onClick={[yield* save, 1]} />; });`),
    // not an event prop
    component(`${evt} return view(function* () { return <b data-save={save} />; });`),
    // not an $event handler (a plain function is the types' business)
    component("const f = () => {}; return view(function* () { return <b onClick={f} />; });"),
    component("return view(function* () { return <b onClick={() => go()} />; });")
  ],
  invalid: [
    {
      code: component(`${evt} return view(function* () { return <b onClick={save} />; });`),
      output: component(
        `${evt} return view(function* () { return <b onClick={yield* save} />; });`
      ),
      errors: [{ messageId: "unbound", data: { name: "save", attr: "onClick" } }]
    },
    {
      code: component(`${evt} return view(function* () { return <b on:click={save} />; });`),
      output: component(
        `${evt} return view(function* () { return <b on:click={yield* save} />; });`
      ),
      errors: [{ messageId: "unbound" }]
    },
    {
      // the bound-data form: the handler is the array's first element
      code: component(`${evt} return view(function* () { return <b onClick={[save, 1]} />; });`),
      output: component(
        `${evt} return view(function* () { return <b onClick={[yield* save, 1]} />; });`
      ),
      errors: [{ messageId: "unbound" }]
    },
    {
      // a foreign component's event prop too
      code: component(`${evt} return view(function* () { return <Router onNavigate={save} />; });`),
      output: component(
        `${evt} return view(function* () { return <Router onNavigate={yield* save} />; });`
      ),
      errors: [{ messageId: "unbound" }]
    },
    {
      // outside a generator there is no yield*: reported, not fixed
      code: `${evt} const el = () => <b onClick={save} />;`,
      output: null,
      errors: [{ messageId: "unbound" }]
    }
  ]
});

// with types: anything typed as an $event handler (the [EVENT] brand)
const eventDecls = `
declare const EVENT: unique symbol;
interface EventHandler<A extends unknown[]> { (...a: A): Promise<void>; readonly [EVENT]: true }
declare function pick(v: string): EventHandler<[]>;
declare const actions: { save: EventHandler<[]> };
declare const plain: () => void;
`;
typedTester.run("no-unbound-event (with types)", rules["no-unbound-event"], {
  valid: [
    { filename, code: eventDecls + "function* v() { return <b onClick={plain} />; }" },
    { filename, code: eventDecls + 'function* v() { return <b onInput={yield* pick("a")} />; }' }
  ],
  invalid: [
    {
      filename,
      code: eventDecls + 'function* v() { return <b onInput={pick("a")} />; }',
      output: eventDecls + 'function* v() { return <b onInput={yield* pick("a")} />; }',
      errors: [{ messageId: "unbound" }]
    },
    {
      filename,
      code: eventDecls + "function* v() { return <b onClick={actions.save} />; }",
      output: eventDecls + "function* v() { return <b onClick={yield* actions.save} />; }",
      errors: [{ messageId: "unbound" }]
    }
  ]
});

// --- no-unshown-wait (D-075, amended: types only) ------------------------------------
// a handler that may wait on pending data carries the [MAY_WAIT] phantom (its `P`)
const waitDecls = `
declare const EVENT: unique symbol;
declare const MAY_WAIT: unique symbol;
interface EventHandler<A extends unknown[], P extends boolean> {
  (...a: A): Promise<void>;
  readonly [EVENT]: true;
  readonly [MAY_WAIT]?: P;
  [Symbol.iterator](): Generator<unknown, (...a: A) => unknown, any>;
}
declare const waits: EventHandler<[], true>;
declare const maybe: EventHandler<[], boolean>;
declare const quick: EventHandler<[], false>;
declare const pick: EventHandler<[string], true>;
declare function h(tag: string, props: object): unknown;
`;
typedTester.run("no-unshown-wait (with types)", rules["no-unshown-wait"], {
  valid: [
    { filename, code: waitDecls + "function* v() { return <b onClick={yield* quick} />; }" },
    { filename, code: waitDecls + "function* v() { return <b onClick={[yield* quick, 1]} />; }" },
    { filename, code: waitDecls + 'const o = h("b", { onClick: quick });' },
    // not an event prop
    { filename, code: waitDecls + "function* v() { return <b title={yield* waits} />; }" }
  ],
  invalid: [
    {
      filename,
      code: waitDecls + "function* v() { return <b onClick={yield* waits} />; }",
      errors: [{ messageId: "wait", data: { name: "waits" } }]
    },
    {
      // `boolean`: it may
      filename,
      code: waitDecls + "function* v() { return <b on:click={yield* maybe} />; }",
      errors: [{ messageId: "wait" }]
    },
    {
      filename,
      code: waitDecls + 'function* v() { return <b onClick={[yield* pick, "a"]} />; }',
      errors: [{ messageId: "wait", data: { name: "pick" } }]
    },
    {
      filename,
      code: waitDecls + 'const o = h("b", { onClick: waits });',
      errors: [{ messageId: "wait" }]
    }
  ]
});

// without type information it cannot know: silent
tester.run("no-unshown-wait (without types)", rules["no-unshown-wait"], {
  valid: [component(`${evt} return view(function* () { return <b onClick={yield* save} />; });`)],
  invalid: []
});

// --- no-try-catch (D-077) ----------------------------------------------------------------
tester.run("no-try-catch", rules["no-try-catch"], {
  valid: [
    // attempt is the routine form
    component(
      "const e = $event(function* () { yield* attempt(() => save(), e => {}); }); return view(function* () { return <i />; });"
    ),
    // plain code inside a routine's plain function is not the routine's body
    component(
      "const e = $event(function* () { yield* attempt(() => { try { return f(); } catch { return 0; } }, e => {}); }); return view(function* () { return <i />; });"
    ),
    // a try with only finally catches nothing
    component("try { x(); } finally { y(); } return view(function* () { return <i />; });"),
    // outside routines
    "function plain() { try { x(); } catch (e) {} }",
    "function* helper() { try { yield 1; } catch {} }"
  ],
  invalid: [
    {
      code: component(
        "const e = $event(function* () { try { yield* save(); } catch (e) { log(e); } }); return view(function* () { return <i />; });"
      ),
      errors: [{ messageId: "tryCatch", data: { where: "an $event" } }]
    },
    {
      code: component("try { x(); } catch {} return view(function* () { return <i />; });"),
      errors: [{ messageId: "tryCatch", data: { where: "a setup" } }]
    },
    {
      code: "const m = $memo(function* () { try { return yield* n; } catch { return 0; } });",
      errors: [{ messageId: "tryCatch", data: { where: "a $memo" } }]
    },
    {
      code: "const f = $effect(function* () { try { return yield* n; } catch {} }, function* () {});",
      errors: [{ messageId: "tryCatch", data: { where: "an $effect" } }]
    },
    {
      // the effect phase is a routine too (D-079)
      code: "const f = $effect(function* () {}, function* (v) { try { yield* save(v); } catch {} });",
      errors: [{ messageId: "tryCatch", data: { where: "an $effect" } }]
    },
    {
      code: component(
        "return view(function* () { try { return <i />; } catch { return <b />; } });"
      ),
      errors: [{ messageId: "tryCatch", data: { where: "a view" } }]
    },
    {
      code: component(
        "return view(function* () { return <ul>{yield* For({ each: xs, children: function* (x) { try { f(); } catch {} return view(function* () { return <li />; }); } })}</ul>; });"
      ),
      errors: [{ messageId: "tryCatch", data: { where: "a row" } }]
    },
    {
      // a bare function* hole given to h
      code: 'const v = h("p", null, function* () { try { return yield* n; } catch { return 0; } });',
      errors: [{ messageId: "tryCatch", data: { where: "a hole" } }]
    }
  ]
});

// --- no-unchecked-foreign-handoff (D-088) -------------------------------------------------
const live =
  'import { component, view } from "solid-yield";\nconst Live = component(function* () { return view(function* () { return <i />; }); });\n';
tester.run("no-unchecked-foreign-handoff", rules["no-unchecked-foreign-handoff"], {
  valid: [
    // checked at the handoff, including generated import aliases
    live +
      'import { foreign as checked } from "solid-yield"; defineRoute({ component: checked(Live) });',
    live + "defineRoute({ path: '/', component: foreign(Live) });",
    live + "const r = <Route path='/' component={foreign(Live)} />;",
    live + 'import { render } from "@solidjs/web";\nrender(foreign(Live), root);',
    live + 'import { render } from "@solidjs/web";\nrender(() => foreign(Live)(), root);',
    // the library's own render / hydrate are the root edge, not a handoff (D-095):
    // typed (a pending root is refused; a failing one re-throws, D-033)
    live + 'import { render } from "solid-yield";\nrender(Live, root);',
    live + 'import { hydrate } from "solid-yield";\nhydrate(() => Live(), document);',
    // a plain Solid component: nothing to check
    "const Page = () => <i />;\ndefineRoute({ path: '/', component: Page });",
    // a yield component called in a routine is not a handoff
    live + "function* v() { return <>{yield* Live()}</>; }"
  ],
  invalid: [
    {
      code: live + "defineRoute({ path: '/', component: Live });",
      errors: [
        {
          messageId: "unchecked",
          data: { name: "Live", where: "a `component` given to foreign code" },
          suggestions: [
            {
              messageId: "wrap",
              output:
                'import { component, view, foreign } from "solid-yield";\nconst Live = component(function* () { return view(function* () { return <i />; }); });\n' +
                "defineRoute({ path: '/', component: foreign(Live) });"
            }
          ]
        }
      ]
    },
    {
      code: live + "const routes = [{ path: '/', component: Live }];",
      errors: [{ messageId: "unchecked", suggestions: 1 }]
    },
    {
      code: live + "const r = <Route path='/' component={Live} />;",
      errors: [
        {
          messageId: "unchecked",
          data: { name: "Live", where: "a foreign tag's `component`" },
          suggestions: 1
        }
      ]
    },
    {
      code: live + 'import { render } from "@solidjs/web";\nrender(Live, root);',
      errors: [
        {
          messageId: "unchecked",
          data: { name: "Live", where: "`render` from @solidjs/web" },
          suggestions: 1
        }
      ]
    },
    {
      code: live + 'import { hydrate } from "@solidjs/web";\nhydrate(() => Live(), root);',
      errors: [{ messageId: "unchecked", suggestions: 1 }]
    }
  ]
});

const handoffDecls = `
declare const COMPONENT: unique symbol;
declare const FAILS: unique symbol;
interface View<P extends boolean, E> { readonly __pending: P; readonly [FAILS]: E }
type ComponentView<P extends boolean, E> = View<P, E> & { readonly [COMPONENT]: true };
declare class ApiError extends Error { readonly kind: "api" }
declare const Page: (props: { id: string }) => ComponentView<true, never>;
declare const Failing: (props: { id: string }) => ComponentView<true, ApiError>;
declare function route<C>(c: C): C;
declare function foreign<C>(c: C): C;
declare function defineRoute(r: { path: string; component: unknown }): void;
declare const Plain: (props: { id: string }) => Node;
`;
typedTester.run(
  "no-unchecked-foreign-handoff (with types)",
  rules["no-unchecked-foreign-handoff"],
  {
    valid: [
      { filename, code: handoffDecls + "defineRoute({ path: '/', component: foreign(Page) });" },
      { filename, code: handoffDecls + "defineRoute({ path: '/', component: Plain });" },
      // the library's render / hydrate: the root edge, which may fail (D-033, D-095)
      {
        filename,
        code: handoffDecls + 'import { render } from "solid-yield";\nrender(Failing, root);'
      },
      {
        filename,
        code:
          handoffDecls +
          'import { hydrate } from "solid-yield";\nhydrate(() => Failing({ id: "1" }), document);'
      }
    ],
    invalid: [
      {
        filename,
        code: handoffDecls + "defineRoute({ path: '/', component: Page });",
        errors: [{ messageId: "unchecked", suggestions: 1 }]
      },
      {
        // the message names what it may fail with
        filename,
        code: handoffDecls + "defineRoute({ path: '/', component: Failing });",
        errors: [
          {
            messageId: "uncheckedFails",
            data: {
              name: "Failing",
              fails: "ApiError",
              where: "a `component` given to foreign code"
            },
            suggestions: 1
          }
        ]
      },
      {
        // a local bridge is not a check: its result is still a yield component
        filename,
        code: handoffDecls + "defineRoute({ path: '/', component: route(Failing) });",
        errors: [{ messageId: "uncheckedFails", suggestions: 1 }]
      },
      {
        // @solidjs/web's renderers are foreign (D-095): a failing root is named
        filename,
        code:
          handoffDecls +
          'import { renderToString } from "@solidjs/web";\nrenderToString(() => Failing({ id: "1" }));',
        errors: [
          {
            messageId: "uncheckedFails",
            data: {
              name: "Failing",
              fails: "ApiError",
              where: "`renderToString` from @solidjs/web"
            },
            suggestions: 1
          }
        ]
      },
      {
        // Solid's lazy over a module whose default export is a yield component
        filename,
        code:
          handoffDecls +
          'import { lazy } from "solid-js";\nconst L = lazy(() => Promise.resolve({ default: Page }));',
        errors: [{ messageId: "solidLazy" }]
      }
    ]
  }
);

// --- require-jsx-factory (D-093): once per tsconfig, typed or not ----------------------
// Each case names its own tsconfig: the rule reports a project once per lint run
// (module state), so two cases sharing one would depend on their order.
const factoryFixture = dir => fileURLToPath(new URL(`./fixtures/${dir}/file.tsx`, import.meta.url));
tester.run("require-jsx-factory (from the nearest tsconfig)", rules["require-jsx-factory"], {
  valid: [
    // both options, through `extends`
    { filename: factoryFixture("jsx-factory"), code: "const a = <>{x}</>;" },
    // not a JSX file: nothing to check
    { filename: factoryFixture("no-fragment-factory").replace(/x$/, ""), code: "const a = 1;" }
  ],
  invalid: [
    {
      filename: factoryFixture("no-fragment-factory"),
      code: "const a = <>{x}</>;",
      errors: [
        {
          messageId: "missing",
          data: {
            config: relative(process.cwd(), factoryFixture("no-fragment-factory")).replace(
              /file\.tsx$/,
              "tsconfig.json"
            ),
            missing: '`"jsxFragmentFactory": "Fragment"`'
          },
          line: 1
        }
      ]
    }
  ]
});
typedTester.run("require-jsx-factory (with types)", rules["require-jsx-factory"], {
  valid: [{ filename: factoryFixture("jsx-factory"), code: "const a = <p />;" }],
  invalid: [
    {
      // the fixtures' own tsconfig sets neither
      filename,
      code: "const a = <p />;",
      errors: [
        {
          messageId: "missing",
          data: {
            config: relative(process.cwd(), `${typedFixtures}/tsconfig.json`),
            missing: '`"jsxFactory": "jsx"` and `"jsxFragmentFactory": "Fragment"`'
          }
        }
      ]
    }
  ]
});
describe("require-jsx-factory reports a project once", () => {
  it("the first JSX file of a tsconfig lacking the options, not the next ones", () => {
    const linter = new Linter({ configType: "flat" });
    const config = [
      {
        files: ["**/*.tsx"],
        languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "solid-yield": { rules } },
        rules: { "solid-yield/require-jsx-factory": "warn" }
      }
    ];
    const lint = name =>
      linter.verify(
        "const a = <>{x}</>;",
        config,
        fileURLToPath(new URL(`./fixtures/once/${name}`, import.meta.url))
      );
    const first = lint("a.tsx");
    expect(first.map(m => [m.ruleId, m.severity, m.line])).toEqual([
      ["solid-yield/require-jsx-factory", 1, 1]
    ]);
    expect(lint("b.tsx")).toEqual([]);
  });
  it("is a warning in recommended", () => {
    expect(plugin.configs.recommended.rules["solid-yield/require-jsx-factory"]).toBe("warn");
  });
});

tester.run("no-read-in-setup", rules["no-read-in-setup"], {
  valid: [
    component(
      "const [n] = yield* $signal(0); function* read() { return yield* n; } const m = yield* $memo(function* () { return yield* read(); }); return view(function* () { return <p>{yield* m}</p>; });"
    ),
    component(
      "const [n] = yield* $signal(0); const m = yield* $memo(function* () { return yield* n; }); return view(function* () { return <p>{yield* m}</p>; });"
    ),
    component(
      "const theme = yield* ThemeCtx; return view(function* () { return <p>{yield* theme}</p>; });"
    ),
    component(
      "yield* $effect(function* () { return yield* props.name; }, function* (name) { console.log(name); }); return view(function* () { return <p/>; });"
    ),
    "const row = For({each: items, children: function* (item) { const [n] = yield* $signal(0); return view(function* () { return <p>{yield* item.name}{yield* n}</p>; }); }});"
  ],
  invalid: [
    {
      code: component(
        "const [n] = yield* $signal(0); const value = yield* n; return view(function* () { return <p>{value}</p>; });"
      ),
      errors: [{ messageId: "read" }]
    },
    {
      code: "const C = component(function* (props) { const value = yield* props.name; return view(function* () { return <p>{value}</p>; }); });",
      errors: [{ messageId: "read" }]
    },
    {
      code: component(
        "const m = yield* $memo(function* () { return 1; }); const value = yield* m; return view(function* () { return <p>{value}</p>; });"
      ),
      errors: [{ messageId: "read" }]
    },
    {
      code: "const row = For({each: items, children: function* (item) { const name = yield* item.name; return view(function* () { return <p>{name}</p>; }); }});",
      errors: [{ messageId: "read" }]
    }
  ]
});

typedTester.run("no-read-in-setup (source aliases with types)", rules["no-read-in-setup"], {
  valid: [
    {
      filename,
      code: `
    declare const ctx: Iterable<unknown>;
    declare function component(fn: () => Generator<any, any, any>): unknown;
    component(function* () { const value = yield* ctx; return value; });
  `
    }
  ],
  invalid: [
    {
      filename,
      code: `
    declare const SOURCE: unique symbol;
    declare const remoteSource: Iterable<unknown> & {readonly [SOURCE]: string};
    declare function component(fn: () => Generator<any, any, any>): unknown;
    component(function* () { const alias = remoteSource; const value = yield* alias; return value; });
  `,
      errors: [{ messageId: "read" }]
    }
  ]
});
