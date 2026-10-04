import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rules, REFUSALS } from "../src/index.js";

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

const component = body => `const C = $component(function* () { ${body} });`;

tester.run("no-throw", rules["no-throw"], {
  valid: [
    component("return function* () { return <p />; };"),
    "function* notABlock() { throw new Error('x'); }",
    component(
      "const f = () => { throw new Error('plain callback'); }; return function* () { return <p />; };"
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
      code: component("return function* () { throw new Error('view'); };"),
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
      "const [n] = yield* $signal(1); return function* () { return <p class={{ a: (yield* n) > 1 }}>{yield* n}</p>; };"
    ),
    component("return function* () { return <section>{yield* Child({})}</section>; };"),
    "const m = $memo(function* () { const v = yield* n; return v; });",
    // a row's setup is not its view (its reads are READ_IN_SETUP's, a type error)
    "const r = <For each={xs}>{function* (x) { const d = yield* $memo(function* () { return yield* x.a; }); return function* () { return <i>{yield* d}</i>; }; }}</For>;",
    // h: an h view (no JSX) is held by its type, [HVIEW_READ], not the lint (D-049)
    component(
      "const [n] = yield* $signal(1); return function* () { return h('p', String(yield* n)); };"
    ),
    component(
      "return function* () { return For({ each: xs, children: function* (x) { return function* () { return h('li', yield* x.a); }; } }); };"
    ),
    // h: the reads are in bare function* holes
    component(
      "const [n] = yield* $signal(1); return function* () { return h('p', { class: function* () { return (yield* n) > 1 ? 'big' : ''; } }, n, function* () { return (yield* n) * 2; }); };"
    ),
    component(
      "return function* () { return For({ each: xs, children: function* (x) { return function* () { return h('li', function* () { return yield* x.a; }); }; } }); };"
    )
  ],
  invalid: [
    {
      code: component(
        "const [n] = yield* $signal(1); return function* () { const v = yield* n; return <p>{v}</p>; };"
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
      code: "const r = <For each={xs}>{function* (x) { return function* () { if (yield* x.done) return <i />; return <b />; }; }}</For>;",
      errors: [{ messageId: "read" }]
    },
    {
      code: component(
        "return function* () { const c = yield* Child({}); return <div>{c}</div>; };"
      ),
      errors: [{ messageId: "child" }]
    },
    {
      // a setup returning one of two views, and a row bound to a const in the setup
      code: component(
        "const row = function* (x) { return function* () { const t = yield* x; return <li>{t}</li>; }; }; return mode ? function* () { return <p>{String(yield* n)}</p>; } : function* () { const v = yield* n; return <i>{v}</i>; };"
      ),
      errors: [{ messageId: "read" }, { messageId: "read" }]
    }
  ]
});

tester.run("no-dollar-block", rules["no-dollar-block"], {
  valid: [
    component(
      "const d = yield* $memo(function* () { return 1; }); return function* () { return <p>{yield* d}</p>; };"
    ),
    // a `$` that is not the library's (a test helper, jQuery)
    "const $ = s => document.querySelector(s); $('p');",
    "import { $ } from 'jquery'; $('p');"
  ],
  invalid: [
    {
      // a derivation in a setup becomes the setup's $memo; the import follows
      code:
        'import { $, $component } from "solid-blocks";\n' +
        component(
          "const d = $(function* () { return 1; }); return function* () { return <p>{yield* d}</p>; };"
        ),
      output:
        'import { $component, $memo } from "solid-blocks";\n' +
        component(
          "const d = yield* $memo(function* () { return 1; }); return function* () { return <p>{yield* d}</p>; };"
        ),
      errors: [{ messageId: "import" }, { messageId: "derived" }]
    },
    {
      // in a row's setup too (D-030)
      code: "const r = <For each={xs}>{function* (x) { const s = $(function* () { return yield* x.a; }); return function* () { return <i>{yield* s}</i>; }; }}</For>;",
      output:
        "const r = <For each={xs}>{function* (x) { const s = yield* $memo(function* () { return yield* x.a; }); return function* () { return <i>{yield* s}</i>; }; }}</For>;",
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
      code: "const v = html`<p>${$(function* () { return 1; })}</p>`;",
      output: "const v = html`<p>${function* () { return 1; }}</p>`;",
      errors: [{ messageId: "hole" }]
    },
    {
      // rows: `$(function* (item) …)` and `$scope(fn)` are the bare function*
      code: 'import { $, $scope, For } from "solid-blocks";\nconst a = <For each={xs}>{$(function* (x) { return function* () { return <i />; }; })}</For>;\nconst b = <For each={xs}>{$scope(row)}</For>;',
      output:
        'import { For } from "solid-blocks";\nconst a = <For each={xs}>{function* (x) { return function* () { return <i />; }; }}</For>;\nconst b = <For each={xs}>{row}</For>;',
      errors: [
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "row" },
        { messageId: "row" }
      ]
    },
    {
      // no fix where no form is equivalent: a module-level source, a JSX child
      code: 'import { $ } from "solid-blocks";\nconst NOBODY = $(function* () { return null; });',
      output: null,
      errors: [{ messageId: "import" }, { messageId: "other" }]
    },
    {
      code: component("return function* () { return <p>{$(function* () { return 1; })}</p>; };"),
      output: null,
      errors: [{ messageId: "other" }]
    }
  ]
});

tester.run("no-path-object-use", rules["no-path-object-use"], {
  valid: [
    // reads compare and spread values
    component(
      "const [s] = yield* $store({ a: { b: 1 } }); const m = yield* $memo(function* () { return { ...(yield* s.a) }; }); return function* () { return <p title={JSON.stringify(yield* s.a)}>{(yield* s.a.b) === 1 ? 'one' : ''}</p>; };"
    ),
    // passing a path on is fine; so is spreading the props object (not a path)
    "const C = $component(function* (props) { return function* () { return <Child {...props} user={props.user} />; }; });",
    // a plain object with the same shape is not a path
    "const s = { a: 1 }; const t = { ...s }; s.a === 1;"
  ],
  invalid: [
    {
      code: "const C = $component(function* (props) { const m = yield* $memo(function* () { return { ...props.user }; }); return function* () { return <p />; }; });",
      errors: [{ messageId: "spread" }]
    },
    {
      code: component(
        "const [s] = yield* $store({ a: 1 }); const m = yield* $memo(function* () { return s.a === 1; }); return function* () { return <p {...s} />; };"
      ),
      errors: [{ messageId: "compare" }, { messageId: "spread" }]
    },
    {
      code: "const r = <For each={xs}>{function* (x) { return function* () { return <i>{JSON.stringify(x)}</i>; }; }}</For>;",
      errors: [{ messageId: "stringify" }]
    },
    {
      code: component(
        "const p = yield* $projection(function* (d) {}, { a: [1] }); const m = yield* $memo(function* () { return p.a[0] !== undefined; }); return function* () { return <p />; };"
      ),
      errors: [{ messageId: "compare" }]
    }
  ]
});

tester.run("prefer-view-wrapper", rules["prefer-view-wrapper"], {
  valid: [
    component("return view(function* () { return <p />; });"),
    "const r = <For each={xs}>{function* (x) { return view(function* () { return <i />; }); }}</For>;"
  ],
  invalid: [
    {
      code:
        'import { $component } from "solid-blocks";\n' +
        component("return function* () { return <p />; };"),
      output:
        'import { $component, view } from "solid-blocks";\n' +
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
      "return function* () { return <Router>{props => <Loading>{props.children}</Loading>}</Router>; };"
    ),
    // a row's view
    "const r = <For each={xs}>{function* (x) { return function* () { return <li />; }; }}</For>;",
    // plain code outside blocks
    "const el = () => <p />;"
  ],
  invalid: [
    {
      code: component(
        "const header = <h1>{yield* title}</h1>; return function* () { return header; };"
      ),
      errors: [{ messageId: "jsx", data: { where: "a setup" } }]
    },
    {
      // a plain function declared in the setup is the setup's code
      code: component("const make = () => <h1 />; return function* () { return <p />; };"),
      errors: [{ messageId: "jsx", data: { where: "a setup" } }]
    },
    {
      code: "const r = <For each={xs}>{function* (x) { const el = <i />; return function* () { return el; }; }}</For>;",
      errors: [{ messageId: "jsx", data: { where: "a row's setup" } }]
    },
    {
      code: "const m = $memo(function* () { return <p />; });",
      errors: [{ messageId: "jsx", data: { where: "a $memo" } }]
    }
  ]
});

const imports = 'import { $component, Show, For, Loading, view } from "solid-blocks";\n';
const Card =
  "const Card = $component(function* (props) { return view(function* () { return <p />; }); });\n";

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
      // a block component tag: props as values / sources / holes, children a lazy view
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
      // outside a block (a root, a test) it is the plain call
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
    { code: imports + "const v = Show({ when: x, children: h('b') });", filename: "app.ts" }
  ],
  invalid: [
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

tester.run("read-before-attempt", rules["read-before-attempt"], {
  valid: [
    "const m = $memo(function* () { const id = yield* props.id; return yield* attempt(() => f(id)); });",
    "const m = $memo(function* () { const u = yield* attempt(() => f()); if (!u) yield* raise(new E()); return u; });",
    "const e = $event(function* () { yield* attempt(() => f()); const v = yield* n; });",
    // an untracked read after an attempt tracks nothing: fine
    "const m = $memo(function* () { const u = yield* attempt(() => f()); return u + (yield* $untrack(n)); });"
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
      "const [n, setN] = yield* $signal(1); const inc = $event(function* () { yield* setN(2); }); yield* $effect(function* () { const v = yield* setN(3); }); return function* () { return <p onClick={inc}>{yield* n}</p>; };"
    ),
    component(
      "const [s, setS] = yield* $optimisticStore({ a: 1 }); const go = $event(function* () { yield* setS(d => { d.a = 2; }); }); return function* () { return <p onClick={go} />; };"
    ),
    // not a block setter: plain code is no-foreign-reactive's concern
    "const [a, setA] = createSignal(1); setA(2);"
  ],
  invalid: [
    {
      code: component(
        "const [n, setN] = yield* $signal(1); const inc = $event(function* () { setN(2); }); return function* () { return <p onClick={inc} />; };"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setN" } }]
    },
    {
      code: component(
        "const [s, setS] = yield* $store({ a: 1 }); setS(d => { d.a = 2; }); return function* () { return <p />; };"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setS" } }]
    },
    {
      code: component(
        "const [n, setN] = yield* $optimistic(1); const bump = () => setN(1); return function* () { return <p />; };"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setN" } }]
    },
    {
      code: component(
        "const [n, setN] = yield* $signal(1); const go = $event(function* () { yield setN(1); }); return function* () { return <p onClick={go} />; };"
      ),
      errors: [{ messageId: "unyielded", data: { name: "setN" } }]
    }
  ]
});

tester.run("no-foreign-reactive", rules["no-foreign-reactive"], {
  valid: [
    'import { $signal, $optimisticStore, until, refresh } from "solid-blocks";',
    'import { lazy, createUniqueId, onCleanup } from "solid-js";',
    'import { query, useNavigate } from "@solidjs/router";',
    'import type { Accessor } from "solid-js";',
    'import { type Signal } from "solid-js";'
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
            hint: " Use `<Switch>` / `<Show>` over the components."
          }
        }
      ]
    },
    {
      code: 'import { flush } from "solid-js";',
      errors: [{ messageId: "foreign", data: { name: "flush", source: "solid-js", hint: "" } }]
    }
  ]
});

// --- the lint's refusals ARE the transform's refusals --------------------------------------------------
// The rule's cases, pinned by vite-plugin-solid-blocks (generated from the fork's Rust rule
// before D-043 removed it from the compiler).
const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../vite-plugin-blocks/test/fixtures/rule.json", import.meta.url)),
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
      const { transform } = await import("vite-plugin-solid-blocks");
      let compiled = null;
      try {
        transform(source, { filename: "case.tsx" });
      } catch (e) {
        compiled = /\[(BLOCKS_[A-Z_]+)\]/.exec(String(e.message))?.[1] ?? "OTHER";
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
        plugins: { blocks: { rules } },
        rules: { "blocks/yield-in-jsx-hole": "error" }
      });
      const linted = messages.length ? /\[(BLOCKS_[A-Z_]+)\]/.exec(messages[0].message)?.[1] : null;
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

// a block component is a function returning a view marked [COMPONENT] (D-067, D-068)
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
