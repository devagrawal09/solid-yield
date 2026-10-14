import { Linter, RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import plugin, { rules } from "../src/index.js";

// Cases the rules' first tests left open, found by mutating the rules' source
// (Stryker over eslint-plugin-yield): each pins a branch a rule takes.

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

describe("every rule's metadata", () => {
  it.each(Object.entries(rules))("%s describes itself and its messages", (_name, rule) => {
    expect(["problem", "suggestion", "layout"]).toContain(rule.meta.type);
    expect(rule.meta.docs.description).toMatch(/\w{3,}/);
    expect(Array.isArray(rule.meta.schema)).toBe(true);
    const messages = Object.entries(rule.meta.messages);
    expect(messages.length).toBeGreaterThan(0);
    for (const [, text] of messages) expect(text).toMatch(/\w{3,}/);
  });
  it("names each rule's kind", () => {
    expect(Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, rule.meta.type])))
      .toMatchInlineSnapshot(`
      {
        "component-call-yielded": "problem",
        "component-children-generator": "problem",
        "jsx-only-in-view": "problem",
        "no-component-tag": "problem",
        "no-dollar-block": "problem",
        "no-foreign-reactive": "problem",
        "no-path-object-use": "problem",
        "no-read-in-prop": "problem",
        "no-read-in-setup": "problem",
        "no-read-in-view-body": "problem",
        "no-throw": "problem",
        "no-try-catch": "problem",
        "no-unbound-event": "problem",
        "no-unchecked-foreign-handoff": "problem",
        "no-unshown-wait": "suggestion",
        "no-unyielded-write": "problem",
        "read-before-attempt": "problem",
        "require-jsx-factory": "suggestion",
        "require-view-wrapper": "problem",
        "yield-in-jsx-hole": "problem",
      }
    `);
  });
  it("recommended turns every rule on, two as warnings", () => {
    expect(plugin.configs.recommended.rules).toEqual(
      Object.fromEntries(
        Object.keys(rules).map(name => [
          `solid-yield/${name}`,
          ["no-unshown-wait", "require-jsx-factory"].includes(name) ? "warn" : "error"
        ])
      )
    );
    expect(plugin.configs.recommended.plugins["solid-yield"]).toBe(plugin);
    expect(plugin.meta.name).toBe("eslint-plugin-solid-yield");
  });
});

const live =
  'import { component, view } from "solid-yield";\nlet Live = component(function* () { return view(function* () { return <i />; }); });\n';
tester.run("no-unchecked-foreign-handoff (edges)", rules["no-unchecked-foreign-handoff"], {
  valid: [
    // not a renderer: a default import, another module's, another export, none
    live + 'import render from "@solidjs/web";\nrender(Live, root);',
    live + 'import { render } from "./render";\nrender(Live, root);',
    live + 'import { mount } from "@solidjs/web";\nmount(Live, root);',
    live + "render(Live, root);",
    live + 'import * as web from "@solidjs/web";\nweb.render(Live, root);',
    // a `component` that is not an initializer of an object literal
    live + "defineRoute({ ['component']: Live });",
    live + "defineRoute({ get component() { return Live; } });",
    live + "({ component: Live } = next);",
    // a tag's `component` that is not an expression of Live
    live + "const r = <Route component='Live' />;",
    live + "const r = <Route component />;",
    live + "const r = <Route ns:component={Live} />;",
    live + "const r = <Route Component={Live} />;",
    // a function handing over a checked component, or something else
    live +
      'import { foreign as checked } from "solid-yield";\nimport { render } from "@solidjs/web";\nrender(() => checked(Live), root);',
    live + 'import { render } from "@solidjs/web";\nrender(() => Live, root);',
    live + 'import { render } from "@solidjs/web";\nrender(function () {}, root);',
    live + 'import { render } from "@solidjs/web";\nrender();',
    // without types, only names and members are known
    live + "defineRoute({ component: [Live][0] });",
    // without types a member is not known to be a component
    'import { component } from "solid-yield";\nconst pages = { home: component(f) };\ndefineRoute({ component: pages.home });',
    // a binding to a member call is not known to be a component
    'import * as Y from "solid-yield";\nlet Live = Y.component(f);\ndefineRoute({ component: Live });',
    // Solid's lazy is only checked with types
    live + 'import { lazy } from "solid-js";\nconst L = lazy(() => import("./live"));'
  ],
  invalid: [
    {
      // a string-named import of a renderer
      code: live + 'import { "render" as mount } from "@solidjs/web";\nmount(Live, root);',
      errors: [
        {
          messageId: "unchecked",
          data: { name: "Live", where: "`render` from @solidjs/web" },
          suggestions: 1
        }
      ]
    },
    {
      // solid-js/web is Solid's too
      code: live + 'import { renderToStream } from "solid-js/web";\nrenderToStream(() => Live());',
      errors: [{ messageId: "unchecked", suggestions: 1 }]
    },
    {
      // a quoted key; the suggestion adds `foreign` after the last named import
      code:
        'import Y, { component, view } from "solid-yield";\nlet Live = component(f);\n' +
        "defineRoute({ 'component': Live });",
      errors: [
        {
          messageId: "unchecked",
          suggestions: [
            {
              messageId: "wrap",
              output:
                'import Y, { component, view, foreign } from "solid-yield";\nlet Live = component(f);\n' +
                "defineRoute({ 'component': foreign(Live) });"
            }
          ]
        }
      ]
    },
    {
      // foreign already imported (but not called): only the wrap
      code:
        'import { component, foreign } from "solid-yield";\nlet Live = component(f);\n' +
        "defineRoute({ component: Live });",
      errors: [
        {
          messageId: "unchecked",
          suggestions: [
            {
              messageId: "wrap",
              output:
                'import { component, foreign } from "solid-yield";\nlet Live = component(f);\n' +
                "defineRoute({ component: foreign(Live) });"
            }
          ]
        }
      ]
    },
    {
      code: 'import * as Y from "solid-yield";\nimport { lazy } from "solid-yield";\nlet Live = lazy(f);\ndefineRoute({ component: Live });',
      errors: [
        {
          messageId: "unchecked",
          suggestions: [
            {
              messageId: "wrap",
              output:
                'import * as Y from "solid-yield";\nimport { lazy } from "solid-yield";\nlet Live = lazy(f);\ndefineRoute({ component: foreign(Live) });'
            }
          ]
        }
      ]
    },
    {
      // a function's result is the handoff: its callee is checked
      code:
        live +
        'import { hydrate } from "@solidjs/web";\nhydrate(function () { return 1; }, root);\nhydrate(() => Live({}), root);',
      errors: [{ messageId: "unchecked", suggestions: 1 }]
    },
    {
      // a JSX tag's component
      code: live + "const r = <Dynamic component={Live} />;",
      errors: [
        {
          messageId: "unchecked",
          data: { name: "Live", where: "a foreign tag's `component`" },
          suggestions: 1
        }
      ]
    }
  ]
});

const handoffDecls = `
declare const COMPONENT: unique symbol;
declare const FAILS: unique symbol;
interface View<P extends boolean, E> { readonly __pending: P; readonly [FAILS]: E }
type ComponentView<P extends boolean, E> = View<P, E> & { readonly [COMPONENT]: true };
declare class ApiError extends Error { readonly kind: "api" }
declare class NotFound extends Error { readonly kind: "missing" }
declare const Page: (props: { id: string }) => ComponentView<true, never>;
declare const Failing: (props: { id: string }) => ComponentView<true, ApiError>;
declare const Either: ((props: { id: string }) => ComponentView<true, ApiError>) | ((props: { id: string }) => ComponentView<true, NotFound>);
declare const Value: number;
declare function defineRoute(r: { path: string; component: unknown }): void;
`;
typedTester.run(
  "no-unchecked-foreign-handoff (with types, edges)",
  rules["no-unchecked-foreign-handoff"],
  {
    valid: [
      // Solid's lazy over a module whose default export is not a yield component
      {
        filename,
        code:
          handoffDecls +
          'import { lazy } from "solid-js";\nconst L = lazy(() => Promise.resolve({ default: Value }));\nconst M = lazy(() => Promise.resolve({ other: Page }));\nconst N = lazy();'
      },
      // another module's lazy
      {
        filename,
        code:
          handoffDecls +
          'import { lazy } from "./lazy";\nconst L = lazy(() => Promise.resolve({ default: Page }));'
      },
      { filename, code: handoffDecls + "defineRoute({ path: '/', component: Value });" }
    ],
    invalid: [
      {
        // a union of components: the first that may fail names it
        filename,
        code: handoffDecls + "defineRoute({ path: '/', component: Either });",
        errors: [
          {
            messageId: "uncheckedFails",
            data: {
              name: "Either",
              fails: "ApiError",
              where: "a `component` given to foreign code"
            },
            suggestions: 1
          }
        ]
      },
      {
        // a long name is shortened in the message
        filename,
        code:
          handoffDecls +
          "declare const pages: { aVeryLongPageNameThatKeepsGoingOnAndOn: typeof Page };\n" +
          "defineRoute({ path: '/', component: pages.aVeryLongPageNameThatKeepsGoingOnAndOn });",
        errors: [
          {
            messageId: "unchecked",
            data: {
              name: "pages.aVeryLongPageNameThatKeepsGoing...",
              where: "a `component` given to foreign code"
            },
            suggestions: 1
          }
        ]
      },
      {
        // a name of exactly 40 characters is kept
        filename,
        code:
          handoffDecls +
          "declare const pages: { aPageNameThatIsExactlyFortyCharsLo: typeof Page };\n" +
          "defineRoute({ path: '/', component: pages.aPageNameThatIsExactlyFortyCharsLo });",
        errors: [
          {
            messageId: "unchecked",
            data: {
              name: "pages.aPageNameThatIsExactlyFortyCharsLo",
              where: "a `component` given to foreign code"
            },
            suggestions: 1
          }
        ]
      },
      {
        // with types any expression is checked
        filename,
        code: handoffDecls + "defineRoute({ path: '/', component: [Page][0] });",
        errors: [
          {
            messageId: "unchecked",
            data: { name: "[Page][0]", where: "a `component` given to foreign code" },
            suggestions: 1
          }
        ]
      },
      {
        filename,
        code:
          handoffDecls +
          'import { lazy } from "solid-js";\nconst L = lazy(() => Promise.resolve({ default: Failing }));',
        errors: [{ messageId: "solidLazy", data: { name: "its default export" } }]
      }
    ]
  }
);

const flow = 'import { component, Show, For, Loading, Errored } from "solid-yield";\n';
const lazyView = jsx => `function* () {\nreturn ${jsx};\n}`;
tester.run("component-children-generator (edges)", rules["component-children-generator"], {
  valid: [
    // not a component call's first argument, or not `children` / `fallback`
    { filename: "app.tsx", code: flow + "const o = { children: <p /> };" },
    { filename: "app.tsx", code: flow + "Show(x, { children: <p /> });" },
    { filename: "app.tsx", code: flow + "Show({ when: x, render: <p /> });" },
    { filename: "app.tsx", code: flow + "Show({ when: x, ['children']: <p /> });" },
    { filename: "app.tsx", code: flow + "show({ when: x, children: <p /> });" },
    { filename: "app.tsx", code: flow + "make()({ children: <p /> });" },
    // a value that is not JSX nor a function: typed by the component
    { filename: "app.tsx", code: flow + "Show({ when: x, children: rows });" },
    // a generator is already one
    {
      filename: "app.tsx",
      code: flow + "Show({ when: x, children: function* () { return <p />; } });"
    },
    // in a file without JSX, a function not returning JSX is built where inserted
    { filename: "app.ts", code: flow + "For({ each: xs, children: (x) => h('li', x) });" },
    { filename: "app.ts", code: flow + "For({ each: xs, children: (x) => { return; } });" },
    {
      filename: "app.ts",
      code: flow + "For({ each: xs, children: (x) => { if (x) return h('li'); } });"
    },
    { filename: "view.tsx.ts", code: flow + "For({ each: xs, children: (x) => h('li', x) });" },
    // a fallback: only a flow control's or boundary's, only JSX, only an initializer
    { filename: "app.tsx", code: flow + "const Card = component(f);\nCard({ fallback: <p /> });" },
    { filename: "app.tsx", code: flow + "ui.Show({ when: x, fallback: <p /> });" },
    { filename: "app.tsx", code: flow + "Show({ when: x, get fallback() { return <p />; } });" },
    { filename: "app.tsx", code: flow + "Show({ when: x, fallback: 'none' });" },
    { filename: "app.tsx", code: "Show({ when: x, fallback: <p /> });".replace("Show", "Panel") }
  ],
  invalid: [
    {
      // a quoted key, and a fragment
      filename: "app.tsx",
      code: flow + "Show({ when: x, 'children': <><p /></> });",
      output: flow + `Show({ when: x, children: ${lazyView("<><p /></>")} });`,
      errors: [{ messageId: "children" }]
    },
    {
      // a getter is a lazy view of what it returns
      filename: "app.tsx",
      code: flow + "Show({ when: x, get children() { return <p />; } });",
      output: flow + `Show({ when: x, children: ${lazyView("<p />")} });`,
      errors: [{ messageId: "children" }]
    },
    {
      // a member call with a capitalized name is a component's
      filename: "app.tsx",
      code: flow + "ui.Card({ children: <p /> });",
      output: flow + `ui.Card({ children: ${lazyView("<p />")} });`,
      errors: [{ messageId: "children" }]
    },
    {
      // in a file not named for JSX, a function returning JSX is a generator too
      filename: "app.js",
      code: flow + "For({ each: xs, children: (x) => <li /> });",
      output:
        flow.replace("Errored }", "Errored, view }") +
        "For({ each: xs, children: function* (x) {\nreturn view(function* () {\nreturn <li />;\n});\n} });",
      errors: [{ messageId: "children" }]
    },
    {
      filename: "app.js",
      code: flow + "For({ each: xs, children: (x) => <></> });",
      output:
        flow.replace("Errored }", "Errored, view }") +
        "For({ each: xs, children: function* (x) {\nreturn view(function* () {\nreturn <></>;\n});\n} });",
      errors: [{ messageId: "children" }]
    },
    {
      filename: "app.js",
      code: flow + "For({ each: xs, children: function (x) { log(x); return <></>; } });",
      output: null,
      errors: [{ messageId: "children" }]
    },
    {
      filename: "app.js",
      code: flow + "For({ each: xs, children: (x) => { return <li />; } });",
      output:
        flow.replace("Errored }", "Errored, view }") +
        "For({ each: xs, children: function* (x) {\nreturn view(function* () {\nreturn <li />;\n});\n} });",
      errors: [{ messageId: "children" }]
    },
    {
      // in a JSX file, any function is
      filename: "app.tsx",
      code: flow + "For({ each: xs, children: (x) => h('li', x) });",
      output:
        flow.replace("Errored }", "Errored, view }") +
        "For({ each: xs, children: function* (x) {\nreturn view(function* () {\nreturn <>{yield* h('li', x)}</>;\n});\n} });",
      errors: [{ messageId: "children" }]
    },
    {
      // a row whose module already imports view: no import added
      filename: "app.tsx",
      code:
        flow.replace("Errored }", "Errored, view }") +
        "For({ each: xs, children: (x) => <li /> });",
      output:
        flow.replace("Errored }", "Errored, view }") +
        "For({ each: xs, children: function* (x) {\nreturn view(function* () {\nreturn <li />;\n});\n} });",
      errors: [{ messageId: "children" }]
    },
    {
      // a lazy view needs no view import
      filename: "app.tsx",
      code: flow + "Show({ when: x, children: () => <p /> });",
      output: flow + `Show({ when: x, children: ${lazyView("<p />")} });`,
      errors: [{ messageId: "children" }]
    },
    {
      // a JSX fallback of each flow control and boundary
      filename: "app.tsx",
      code: flow + "Errored({ fallback: <></> });\nLoading({ fallback: <p /> });",
      output:
        flow +
        `Errored({ fallback: ${lazyView("<></>")} });\nLoading({ fallback: ${lazyView("<p />")} });`,
      errors: [
        { messageId: "fallback", data: { name: "Errored" } },
        { messageId: "fallback", data: { name: "Loading" } }
      ]
    }
  ]
});

const setupOf = body => `const C = component(function* () { ${body} });`;
tester.run("no-dollar-block (edges)", rules["no-dollar-block"], {
  valid: [
    // not the library's `$`: a local function, a declared global, a variable, a member
    "function $(f) { return f; }\n$(function* () { return 1; });",
    "/* global $ */\n$(function* () { return 1; });",
    "let $ = f;\n$(function* () { return 1; });",
    "ui.$(function* () { return 1; });",
    "$$(function* () { return 1; });"
  ],
  invalid: [
    {
      // `$()` and a plain function have no routine form, even in a hole or a setup
      code: "$();\nconst v = h('p', $(() => 1));\n" + setupOf("const d = $(() => 1);"),
      output: null,
      errors: [{ messageId: "other" }, { messageId: "other" }, { messageId: "other" }]
    },
    {
      // the solid-yield `$` imported by default is the library's
      code: 'import $ from "solid-yield";\nconst v = h("p", $(function* () { return 1; }));',
      output: 'import $ from "solid-yield";\nconst v = h("p", function* () { return 1; });',
      errors: [{ messageId: "hole" }]
    },
    {
      // keys of h's props: a value is a hole; on*, ref, children are not
      code: "const v = h('p', { 'icon': $(function* () { return 1; }), 'onClick': $(function* () {}), ref: $(function* () {}), children: $(function* () {}), onpointerdown: $(function* () {}) });",
      output:
        "const v = h('p', { 'icon': function* () { return 1; }, 'onClick': $(function* () {}), ref: $(function* () {}), children: $(function* () {}), onpointerdown: $(function* () {}) });",
      errors: [
        { messageId: "hole" },
        { messageId: "other" },
        { messageId: "other" },
        { messageId: "other" },
        { messageId: "other" }
      ]
    },
    {
      // a computed key is no prop; h's tag is no hole, unless an array
      code: "const v = h('p', { [$(function* () {})]: 1 });\nconst w = h($(function* () {}));\nconst x = h([$(function* () { return 1; })]);",
      output:
        "const v = h('p', { [$(function* () {})]: 1 });\nconst w = h($(function* () {}));\nconst x = h([function* () { return 1; }]);",
      errors: [{ messageId: "other" }, { messageId: "other" }, { messageId: "hole" }]
    },
    {
      // a flow control's source props in its first argument are holes; others are not
      code: "Repeat({ count: $(function* () { return 1; }) });\nFor({ each: $(function* () { return []; }) });\nLoading({ on: $(function* () { return 1; }) });\nShow(x, { when: $(function* () {}) });\nShow($(function* () {}));\nwrap({ when: $(function* () {}) });\nui.h('p', $(function* () {}));",
      output:
        "Repeat({ count: function* () { return 1; } });\nFor({ each: function* () { return []; } });\nLoading({ on: function* () { return 1; } });\nShow(x, { when: $(function* () {}) });\nShow($(function* () {}));\nwrap({ when: $(function* () {}) });\nui.h('p', $(function* () {}));",
      errors: [
        { messageId: "hole" },
        { messageId: "hole" },
        { messageId: "hole" },
        { messageId: "other" },
        { messageId: "other" },
        { messageId: "other" },
        { messageId: "other" }
      ]
    },
    {
      // in a setup, only a declared derivation is a $memo
      code: setupOf("for ($(function* () { return 1; }); ; ) break; use($(function* () {}));"),
      output: null,
      errors: [{ messageId: "other" }, { messageId: "other" }]
    },
    {
      // the import: $memo kept once; the declaration rewritten only when something is dropped
      code:
        'import { $, $memo, component } from "solid-yield";\n' +
        setupOf("const d = $(function* () { return 1; });"),
      output:
        'import { $memo, component } from "solid-yield";\n' +
        setupOf("const d = yield* $memo(function* () { return 1; });"),
      errors: [{ messageId: "import", data: { name: "$" } }, { messageId: "derived" }]
    },
    {
      code: 'import {$} from "solid-yield";\nconst d = $(() => 1);',
      output: null,
      errors: [{ messageId: "import" }, { messageId: "other" }]
    },
    {
      // $memo placed after the `$` creators that sort before it
      code:
        'import { $, $effect, $signal, component } from "solid-yield";\n' +
        setupOf("const d = $(function* () { return 1; });"),
      output:
        'import { $effect, $memo, $signal, component } from "solid-yield";\n' +
        setupOf("const d = yield* $memo(function* () { return 1; });"),
      errors: [{ messageId: "import" }, { messageId: "derived" }]
    },
    {
      // a default import stays; the braces go with the last named one
      code: 'import Y, { $ } from "solid-yield";\nconst v = h("p", $(function* () { return 1; }));',
      output: 'import Y from "solid-yield";\nconst v = h("p", function* () { return 1; });',
      errors: [{ messageId: "import" }, { messageId: "hole" }]
    },
    {
      code: 'import Y, { $, component } from "solid-yield";\nconst v = h("p", $(function* () { return 1; }));',
      output:
        'import Y, { component } from "solid-yield";\nconst v = h("p", function* () { return 1; });',
      errors: [{ messageId: "import" }, { messageId: "hole" }]
    },
    {
      code: 'import Y, { $ } from "solid-yield";\nconst d = $(() => 1);',
      output: null,
      errors: [{ messageId: "import" }, { messageId: "other" }]
    },
    {
      // every specifier dropped: the declaration goes
      code: 'import { $ } from "solid-yield";\nconst v = h("p", $(function* () { return 1; }));',
      output: '\nconst v = h("p", function* () { return 1; });',
      errors: [{ messageId: "import" }, { messageId: "hole" }]
    },
    {
      // `$scope` with nothing given is still a row to unwrap
      code: 'import { $scope } from "solid-yield";\nconst r = $scope();',
      output: null,
      errors: [{ messageId: "import", data: { name: "$scope" } }, { messageId: "other" }]
    }
  ]
});

const tagImports =
  'import { component, Show, For } from "solid-yield";\nconst Card = component(f);\n';
const inRoutine = body =>
  `const C = component(function* () { return view(function* () { return ${body}; }); });`;
tester.run("no-component-tag (edges)", rules["no-component-tag"], {
  valid: [
    // a lowercase tag is a DOM element, whatever it is bound to
    tagImports + "const card = component(f);\nconst v = <card />;",
    tagImports + "const myCard = component(f);\nconst v = <myCard />;",
    tagImports + "const v = <svg:Card />;",
    // a member tag is not known without types
    tagImports + "const v = <ui.Card />;"
  ],
  invalid: [
    {
      // no props, in a fragment; no children: no view import
      code: tagImports + inRoutine("<><Card /></>"),
      output: tagImports + inRoutine("<>{yield* Card()}</>"),
      errors: [{ messageId: "tag", data: { name: "Card" } }]
    },
    {
      // an empty attribute (`b={}`, a comment alone) passes nothing
      code: tagImports + inRoutine("<p><Card a={} b={/* later */} c={1} /></p>"),
      output: tagImports + inRoutine("<p>{yield* Card({ c: 1 })}</p>"),
      errors: [{ messageId: "tag" }]
    },
    {
      // keys that are not identifiers are quoted
      code: tagImports + inRoutine('<p><Card data-x="1" on:click={f} /></p>'),
      output: tagImports + inRoutine('<p>{yield* Card({ "data-x": "1", "on:click": f })}</p>'),
      errors: [{ messageId: "tag" }]
    },
    {
      // a row child: the module's import gains `view`
      code: tagImports + inRoutine("<ul><For each={xs}>{(x) => <li />}</For></ul>"),
      output:
        tagImports.replace("For }", "For, view }") +
        inRoutine(
          "<ul>{yield* For({ each: xs, children: function* (x) {\nreturn view(function* () {\nreturn <li />;\n});\n} })}</ul>"
        ),
      errors: [{ messageId: "tag" }]
    },
    {
      // children with no fix: the tag has none either
      code: tagImports + inRoutine("<ul><Card>{() => { log(); return <p />; }}</Card></ul>"),
      output: null,
      errors: [{ messageId: "tag" }]
    },
    {
      // a tag given as an attribute's value is a lazy view
      code: tagImports + inRoutine("<div title={<Card />} />"),
      output:
        tagImports + inRoutine("<div title={function* () {\nreturn <>{yield* Card()}</>;\n}} />"),
      errors: [{ messageId: "tag" }]
    },
    {
      // held by an object that is no component's props: the fragment hole
      code:
        tagImports +
        "const C = component(function* () { const o = { a: <Card /> }; makeShow({ fallback: <Card /> }); ui.Show({ fallback: <Card /> }); return null; });",
      output:
        tagImports +
        "const C = component(function* () { const o = { a: <>{yield* Card()}</> }; makeShow({ fallback: <>{yield* Card()}</> }); ui.Show({ fallback: <>{yield* Card()}</> }); return null; });",
      errors: [{ messageId: "tag" }, { messageId: "tag" }, { messageId: "tag" }]
    },
    {
      // outside a routine, in JSX: the plain call in braces
      code: tagImports + "const f = () => <div><Card a={1} /></div>;",
      output: tagImports + "const f = () => <div>{Card({ a: 1 })}</div>;",
      errors: [{ messageId: "tag" }]
    }
  ]
});

tester.run("component-children-generator (callees)", rules["component-children-generator"], {
  valid: [
    { filename: "app.tsx", code: "makePanel({ children: <p /> });" },
    { filename: "app.tsx", code: 'ui["Panel"]({ children: <p /> });' }
  ],
  invalid: [
    {
      // a yield component under a lowercase name, an unknown capitalized callee
      filename: "app.tsx",
      code: 'import { component } from "solid-yield";\nconst card = component(f);\ncard({ children: <p /> });\nPanel({ children: <p /> });',
      output:
        'import { component } from "solid-yield";\nconst card = component(f);\n' +
        `card({ children: ${lazyView("<p />")} });\nPanel({ children: ${lazyView("<p />")} });`,
      errors: [{ messageId: "children" }, { messageId: "children" }]
    }
  ]
});

const waitDecls = `
declare const EVENT: unique symbol;
declare const MAY_WAIT: unique symbol;
interface EventHandler<A extends unknown[], P extends boolean> {
  (...a: A): Promise<void>;
  readonly [EVENT]: true;
  readonly [MAY_WAIT]?: P;
  [Symbol.iterator](): Generator<unknown, (...a: A) => unknown, any>;
}
interface Always {
  (): Promise<void>;
  readonly [EVENT]: true;
  readonly [MAY_WAIT]: true;
  [Symbol.iterator](): Generator<unknown, () => unknown, any>;
}
declare const waits: EventHandler<[], true>;
declare const always: Always;
declare const partly: EventHandler<[], true> | (() => void);
declare const handlers: { aVeryLongHandlerNameThatGoesOnAndOnAndOn: EventHandler<[], true> };
declare function h(tag: unknown, props?: object): unknown;
declare function f(props: object): unknown;
declare const ui: { h: typeof h };
`;
typedTester.run("no-unshown-wait (edges)", rules["no-unshown-wait"], {
  valid: [
    // a bind that is not a delegated read of the handler
    { filename, code: waitDecls + "function* v() { return <b onClick />; }" },
    { filename, code: waitDecls + 'function* v() { return <b onClick="x" />; }' },
    { filename, code: waitDecls + "function* v() { return <b onClick={waits} />; }" },
    { filename, code: waitDecls + "function* v() { return <b onClick={yield waits} />; }" },
    { filename, code: waitDecls + "function* v() { return <b onClick={[]} />; }" },
    // h's props: not an event key, not h's props object, not an initializer
    { filename, code: waitDecls + 'h("b", { buttonClick: waits });' },
    { filename, code: waitDecls + 'h("b", { ["onClick"]: waits });' },
    { filename, code: waitDecls + 'h("b", { get onClick() { return waits; } });' },
    { filename, code: waitDecls + "f({ onClick: waits });" },
    { filename, code: waitDecls + "h({ onClick: waits });" },
    { filename, code: waitDecls + 'ui.h("b", { onClick: waits });' },
    { filename, code: waitDecls + "const o = { onClick: waits };" },
    { filename, code: waitDecls + 'h("b", { onClick: [] });' }
  ],
  invalid: [
    {
      // a may-wait that is not optional; a union where one member may wait
      filename,
      code:
        waitDecls +
        "function* v() { return <><b onClick={yield* always} /><i onClick={yield* partly} /></>; }",
      errors: [
        { messageId: "wait", data: { name: "always" } },
        { messageId: "wait", data: { name: "partly" } }
      ]
    },
    {
      // a long name is shortened
      filename,
      code:
        waitDecls +
        "function* v() { return <b onClick={yield* handlers.aVeryLongHandlerNameThatGoesOnAndOnAndOn} />; }",
      errors: [{ messageId: "wait", data: { name: "handlers.aVeryLongHandlerNameThatGoes..." } }]
    },
    {
      // h's quoted and namespaced event keys, and a handler with its data
      filename,
      code:
        waitDecls +
        'h("b", { "onClick": waits, "on:click": waits, "oncapture:click": waits, onKeyDown: [waits, 1] });',
      errors: [
        { messageId: "wait" },
        { messageId: "wait" },
        { messageId: "wait" },
        { messageId: "wait" }
      ]
    }
  ]
});

tester.run("no-unchecked-foreign-handoff (renderers)", rules["no-unchecked-foreign-handoff"], {
  valid: [],
  invalid: [
    {
      code:
        live +
        'import { renderToStringAsync } from "@solidjs/web";\nrenderToStringAsync(() => Live());',
      errors: [{ messageId: "unchecked", suggestions: 1 }]
    }
  ]
});

const inSetup = body =>
  `const C = component(function* () { ${body} return view(function* () { return <p />; }); });`;
tester.run("no-unyielded-write (edges)", rules["no-unyielded-write"], {
  valid: [
    // the getter, a missing or nested setter slot, a plain or non-delegated creation
    inSetup("const [n, setN] = yield* $signal(1); n();"),
    inSetup("const [n] = yield* $signal(1); n();"),
    inSetup("const [n, [setN]] = yield* $signal(1); setN(2);"),
    inSetup("const [a, setA] = $signal(1); setA(2);"),
    inSetup("const [a, setA] = yield $signal(1); setA(2);"),
    // not a creator: an unknown call, a source, a local or imported function of another name
    inSetup("const [a, setA] = yield* other(1); setA(2);"),
    inSetup("const [a, setA] = yield* src; setA(2);"),
    inSetup("function sig(v) { return v; } const [a, setA] = yield* sig(1); setA(2);"),
    inSetup("const sig = make; const [a, setA] = yield* sig(1); setA(2);"),
    'import { $signal as sig } from "other";\n' +
      inSetup("const [a, setA] = yield* sig(1); setA(2);"),
    'import sig from "solid-yield";\n' + inSetup("const [a, setA] = yield* sig(1); setA(2);"),
    'import { $memo as sig } from "solid-yield";\n' +
      inSetup("const [a, setA] = yield* sig(1); setA(2);")
  ],
  invalid: [
    {
      // each creator, under its own name and imported under another
      code:
        'import { $store as st, $optimisticStore as os } from "solid-yield";\n' +
        inSetup(
          "const [a, setA] = yield* $signal(1); const [b, setB] = yield* $optimistic(1); const [c, setC] = yield* st({}); const [d, setD] = yield* os({}); setA(1); setB(1); setC(1); setD(1);"
        ),
      errors: ["setA", "setB", "setC", "setD"].map(name => ({
        messageId: "unyielded",
        data: { name }
      }))
    }
  ]
});

const writeDecls = `
interface Yieldable<Y, R> { [Symbol.iterator](): Generator<Y, R, any>; }
interface EventCall<R> extends Promise<R>, Yieldable<unknown, R> { readonly __call: true }
interface Saver<T> extends Yieldable<unknown, T> { readonly saver: true }
declare function $event<A extends unknown[]>(f: (...a: A) => Generator<unknown, unknown, unknown>): (...a: A) => EventCall<void>;
declare function attempt<T>(f: () => T): Yieldable<unknown, T>;
declare function maybeOp(): Yieldable<unknown, void> | undefined;
declare function save(): Saver<number>;
declare const actions: {
  save: (x: number) => EventCall<void>;
  maybe: (x: number) => EventCall<void> | undefined;
  aVeryLongActionNameThatIsVeryVeryLong: (x: number) => EventCall<void>;
  anActionNameThatIsFortyCharsLong: (x: number) => EventCall<void>;
};
`;
const inEvent = body => `${writeDecls}const e = $event(function* () { ${body} });`;
typedTester.run("no-unyielded-write (with types, edges)", rules["no-unyielded-write"], {
  valid: [
    { filename, code: inEvent("const x = attempt(() => 1);") },
    { filename, code: inEvent("const ok = !attempt(() => 1);") },
    { filename, code: inEvent("const t = typeof attempt(() => 1);") },
    // outside a routine nothing is known to be discarded
    { filename, code: writeDecls + "attempt(() => 1); actions.save(1);" }
  ],
  invalid: [
    {
      // a union holding an operation; one extending one; an optional call; void
      filename,
      code: inEvent("maybeOp(); save(); attempt?.(() => 1); void attempt(() => 1);"),
      errors: [
        { messageId: "discarded", data: { name: "maybeOp" } },
        { messageId: "discarded", data: { name: "save" } },
        { messageId: "discarded", data: { name: "attempt" } },
        { messageId: "discarded", data: { name: "attempt" } }
      ]
    },
    {
      // an event call in a union, in a for-initializer, under a long name
      filename,
      code: inEvent(
        "actions.maybe(1); for (actions.save(1); ; ) break; actions.aVeryLongActionNameThatIsVeryVeryLong(1); actions.anActionNameThatIsFortyCharsLong(1);"
      ),
      errors: [
        { messageId: "eventCall", data: { name: "actions.maybe" } },
        { messageId: "eventCall", data: { name: "actions.save" } },
        { messageId: "eventCall", data: { name: "actions.aVeryLongActionNameThatIsVery..." } },
        { messageId: "eventCall", data: { name: "actions.anActionNameThatIsFortyCharsLong" } }
      ]
    }
  ]
});

tester.run("no-foreign-reactive (edges)", rules["no-foreign-reactive"], {
  valid: [
    // native mode keeps plain Solid
    {
      code: 'import { createSignal } from "solid-js";',
      settings: { "solid-yield": { mode: "native" } }
    },
    // types, a default import, an inline type
    'import type { createSignal } from "solid-js";',
    'import solid from "solid-js";',
    'import { type createSignal, lazy } from "solid-js";',
    // what native mode kept on purpose
    {
      code: 'import { createSignal } from "solid-js";',
      settings: { "solid-yield": { foreign: { "solid-js": ["createSignal"] } } }
    }
  ],
  invalid: [
    {
      // kept names are per module; settings without any
      code: 'import { createSignal } from "solid-js";\nimport { createMemo } from "@solidjs/signals";',
      settings: { "solid-yield": { foreign: { "@solidjs/signals": ["createSignal"] } } },
      errors: [
        {
          messageId: "foreign",
          data: { name: "createSignal", source: "solid-js", hint: " Use `$signal`." }
        },
        {
          messageId: "foreign",
          data: { name: "createMemo", source: "@solidjs/signals", hint: " Use `$memo`." }
        }
      ]
    },
    {
      code: 'import { createSignal } from "solid-js";',
      settings: { "solid-yield": {} },
      errors: [{ messageId: "foreign" }]
    },
    {
      // a string-named import; a name with no routine form
      code: 'import { "createSignal" as cs } from "solid-js";\nimport { useIsRouting } from "@solidjs/router";',
      errors: [
        {
          messageId: "foreign",
          data: { name: "createSignal", source: "solid-js", hint: " Use `$signal`." }
        },
        {
          messageId: "foreign",
          data: { name: "useIsRouting", source: "@solidjs/router", hint: "" }
        }
      ]
    },
    {
      // flush in a routine, from @solidjs/signals too
      code:
        'import { flush } from "@solidjs/signals";\n' +
        "const C = component(function* () { flush(); return view(function* () { return <p />; }); });",
      errors: [{ messageId: "inRoutine", data: { name: "flush", source: "@solidjs/signals" } }]
    }
  ]
});

// each foreign API's advice, as the reader sees it
const advice = {
  "solid-js": {
    createSignal: "`$signal`",
    createMemo: "`$memo`",
    createStore: "`$store`",
    createProjection: "`$projection`",
    createOptimistic: "`$optimistic`",
    createOptimisticStore: "`$optimisticStore`",
    createEffect: "`$effect(compute, effect)`",
    createRenderEffect: "`$effect`",
    createTrackedEffect:
      "`$effect(compute, effect)` (a tracked effect is the compute; its writes go in the effect phase)",
    createReaction: "`$effect`",
    onSettled:
      "`$effect(function* () {}, function* () { … })` (an empty compute: its effect phase runs once, after the first render, D-101)",
    action: "`$event`",
    until: "`until` from solid-yield",
    refresh: "`refresh` from solid-yield",
    isPending: "`isPendingOf`",
    latest: "`latestOf`",
    untrack:
      "a plain `yield*` where the host does not track: an `$event`, or an `$effect`'s effect phase"
  },
  "@solidjs/router": {
    useLocation: "the route component's props (`yield* props.location…`, `yield* props.params…`)",
    useParams: "the route component's props (`yield* props.location…`, `yield* props.params…`)",
    useSearchParams:
      "the route component's props (`yield* props.location…`, `yield* props.params…`)",
    useMatch: "the route component's props (`yield* props.location…`, `yield* props.params…`)",
    useCurrentMatches:
      "the route component's props (`yield* props.location…`, `yield* props.params…`)",
    useIsRouting: null,
    useSubmission: null,
    useSubmissions: null,
    createAsync: "`$memo`",
    createAsyncStore: "`$optimisticStore` or `$projection`"
  },
  "@solidjs/web": { dynamic: "`Switch(…)` / `Show(…)` over the components" }
};
tester.run("no-foreign-reactive (advice)", rules["no-foreign-reactive"], {
  valid: [],
  invalid: Object.entries(advice).map(([source, names]) => ({
    code: `import { ${Object.keys(names).join(", ")} } from "${source}";`,
    errors: Object.entries(names).map(([name, use]) => ({
      messageId: "foreign",
      data: { name, source, hint: use ? ` Use ${use}.` : "" }
    }))
  }))
});

tester.run("flow controls (edges)", rules["component-children-generator"], {
  valid: [],
  invalid: [
    {
      filename: "app.tsx",
      code: "Show({ when: x, fallback: <p /> });\nSwitch({ fallback: <p /> });\nMatch({ when: x, fallback: <p /> });",
      output:
        `Show({ when: x, fallback: ${lazyView("<p />")} });\n` +
        `Switch({ fallback: ${lazyView("<p />")} });\n` +
        `Match({ when: x, fallback: ${lazyView("<p />")} });`,
      errors: [
        { messageId: "fallback", data: { name: "Show" } },
        { messageId: "fallback", data: { name: "Switch" } },
        { messageId: "fallback", data: { name: "Match" } }
      ]
    }
  ]
});
tester.run("flow controls' holes (edges)", rules["no-dollar-block"], {
  valid: [],
  invalid: [
    {
      code: "Match({ when: $(function* () { return 1; }) });\nSwitch({ when: $(function* () { return 1; }) });",
      output:
        "Match({ when: function* () { return 1; } });\nSwitch({ when: function* () { return 1; } });",
      errors: [{ messageId: "hole" }, { messageId: "hole" }]
    }
  ]
});

const viewless = body => `const C = component(function* () { return function* () { ${body} }; });`;
tester.run("require-view-wrapper (edges)", rules["require-view-wrapper"], {
  valid: [
    // a lazy view is typed by the call it is a prop of
    'import { component, Show } from "solid-yield";\nconst C = component(function* () { return Show({ when: x, children: function* () { return <p />; } }); });'
  ],
  invalid: [
    {
      // the fix imports view into solid-yield's value import, not another's
      code:
        'import { x } from "other";\nimport type { T } from "solid-yield";\nimport { component } from "solid-yield";\n' +
        viewless("return <p />;"),
      output:
        'import { x } from "other";\nimport type { T } from "solid-yield";\nimport { component, view } from "solid-yield";\n' +
        "const C = component(function* () { return view(function* () { return <p />; }); });",
      errors: [{ messageId: "wrap" }]
    },
    {
      // view imported (also under another name), or no named import to extend
      code: 'import { component, view } from "solid-yield";\n' + viewless("return <p />;"),
      output:
        'import { component, view } from "solid-yield";\n' +
        "const C = component(function* () { return view(function* () { return <p />; }); });",
      errors: [{ messageId: "wrap" }]
    },
    {
      code: 'import { component, view as v } from "solid-yield";\n' + viewless("return <p />;"),
      output:
        'import { component, view as v, view } from "solid-yield";\n' +
        "const C = component(function* () { return view(function* () { return <p />; }); });",
      errors: [{ messageId: "wrap" }]
    },
    {
      code: 'import Y from "solid-yield";\n' + viewless("return <p />;"),
      output:
        'import Y from "solid-yield";\n' +
        "const C = component(function* () { return view(function* () { return <p />; }); });",
      errors: [{ messageId: "wrap" }]
    },
    {
      code: 'import Y, { component } from "solid-yield";\n' + viewless("return <p />;"),
      output:
        'import Y, { component, view } from "solid-yield";\n' +
        "const C = component(function* () { return view(function* () { return <p />; }); });",
      errors: [{ messageId: "wrap" }]
    }
  ]
});

tester.run("jsx-only-in-view (edges)", rules["jsx-only-in-view"], {
  valid: [
    // a plain function two levels down is not the setup's own code
    "const C = component(function* () { function make() { return () => <p />; } return view(function* () { return <i />; }); });",
    "const C = component(function* () { const make = () => { function inner() { return <p />; } }; return view(function* () { return <i />; }); });",
    "const C = component(function* () { const outer = () => { const make = function () { return <p />; }; }; return view(function* () { return <i />; }); });",
    "const C = component(function* () { function outer() { const make = function () { return <p />; }; } return view(function* () { return <i />; }); });"
  ],
  invalid: [
    {
      // the outermost JSX only; a render callback in it is not reported
      code: "const C = component(function* () { const a = <div><p /></div>; const b = <><p /></>; const c = <div>{() => <p />}</div>; return view(function* () { return <i />; }); });",
      errors: [
        { messageId: "jsx", data: { where: "a setup" } },
        { messageId: "jsx", data: { where: "a setup" } },
        { messageId: "jsx", data: { where: "a setup" } }
      ]
    },
    {
      // a plain function declared directly in a routine is its code
      code: "const C = component(function* () { const a = () => <p />; function b() { return <p />; } const c = function () { return <></>; }; return view(function* () { return <i />; }); });",
      errors: [
        { messageId: "jsx", data: { where: "a setup" } },
        { messageId: "jsx", data: { where: "a setup" } },
        { messageId: "jsx", data: { where: "a setup" } }
      ]
    },
    {
      code: "const e = $effect(function* () { return <p />; }, function* () { const v = <i />; });\nconst ev = $event(function* () { const v = <i />; });\nconst m = $memo(function* () { return <b />; });",
      errors: [
        { messageId: "jsx", data: { where: "an $effect" } },
        { messageId: "jsx", data: { where: "an $effect" } },
        { messageId: "jsx", data: { where: "an $event" } },
        { messageId: "jsx", data: { where: "a $memo" } }
      ]
    },
    {
      code: "const r = <For each={xs}>{function* (x) { const v = <i />; return view(function* () { return <li />; }); }}</For>;",
      errors: [{ messageId: "jsx", data: { where: "a row's setup" } }]
    }
  ]
});

const evtDecl = "const save = $event(function* () {});\n";
const bound = attrs => `${evtDecl}function* v() { return <b ${attrs} />; }`;
tester.run("no-unbound-event (edges)", rules["no-unbound-event"], {
  valid: [
    // an empty handler attribute binds nothing
    bound("onClick={}"),
    bound("onClick={/* later */}"),
    // not an event attribute
    bound("on={save}"),
    bound("onclick={save}"),
    bound("on1={save}"),
    bound("on_={save}"),
    bound("ofClick={save}"),
    bound("foo:click={save}"),
    // no expression, or nothing a handler
    bound("onClick"),
    bound('onClick="save"'),
    bound("onClick={[]}"),
    bound("onClick={yield save}"),
    bound("onClick={make()}"),
    bound("onClick={obj.save}"),
    bound("onClick={unbound}"),
    "function save() {}\nfunction* v() { return <b onClick={save} />; }",
    "let save;\nfunction* v() { return <b onClick={save} />; }",
    "const save = make(f);\nfunction* v() { return <b onClick={save} />; }"
  ],
  invalid: [
    {
      // the boundaries of an event name; namespaced forms
      code: bound("onA={save} onZ={save} oncapture:click={save}"),
      output: bound("onA={yield* save} onZ={yield* save} oncapture:click={yield* save}"),
      errors: [
        { messageId: "unbound", data: { name: "save", attr: "onA" } },
        { messageId: "unbound", data: { name: "save", attr: "onZ" } },
        { messageId: "unbound", data: { name: "save", attr: "oncapture:click" } }
      ]
    },
    {
      // an $event call given directly; a long name shortened
      code:
        "const aVeryLongHandlerNameThatKeepsOnGoingAndGoing = $event(f);\nconst aHandlerNameThatIsExactlyFortyCharacters = $event(f);\n" +
        "function* v() { return <b onClick={$event(f)} onInput={aVeryLongHandlerNameThatKeepsOnGoingAndGoing} onKeyDown={aHandlerNameThatIsExactlyFortyCharacters} />; }",
      output:
        "const aVeryLongHandlerNameThatKeepsOnGoingAndGoing = $event(f);\nconst aHandlerNameThatIsExactlyFortyCharacters = $event(f);\n" +
        "function* v() { return <b onClick={yield* $event(f)} onInput={yield* aVeryLongHandlerNameThatKeepsOnGoingAndGoing} onKeyDown={yield* aHandlerNameThatIsExactlyFortyCharacters} />; }",
      errors: [
        { messageId: "unbound", data: { name: "$event(f)", attr: "onClick" } },
        {
          messageId: "unbound",
          data: { name: "aVeryLongHandlerNameThatKeepsOnGoingA...", attr: "onInput" }
        },
        {
          messageId: "unbound",
          data: { name: "aHandlerNameThatIsExactlyFortyCharacters", attr: "onKeyDown" }
        }
      ]
    }
  ]
});

const unboundDecls = `
declare const EVENT: unique symbol;
interface EventHandler<A extends unknown[]> { (...a: A): Promise<void>; readonly [EVENT]: true }
declare const maybe: EventHandler<[]> | undefined;
declare const save: EventHandler<[]>;
declare const other: EventHandler<[]>;
declare const flag: boolean;
`;
typedTester.run("no-unbound-event (with types, edges)", rules["no-unbound-event"], {
  valid: [],
  invalid: [
    {
      // a union holding a handler; an expression that is no simple reference has no fix
      filename,
      code:
        unboundDecls +
        "function* v() { return <b onClick={maybe} onInput={flag ? save : other} />; }",
      output:
        unboundDecls +
        "function* v() { return <b onClick={yield* maybe} onInput={flag ? save : other} />; }",
      errors: [
        { messageId: "unbound", data: { name: "maybe", attr: "onClick" } },
        { messageId: "unbound" }
      ]
    }
  ]
});

const memoOf = expr =>
  `const m = yield* $memo(function* () { return ${expr}; }); return view(function* () { return <p />; });`;
tester.run("no-path-object-use (edges)", rules["no-path-object-use"], {
  valid: [
    // not paths: another parameter of a setup, a memo's parameter, a plain function's
    `const C = component(function* (props, other) { ${memoOf("other.x === 1")} });`,
    `const m = $memo(function* (prev) { return prev.a === 1; });`,
    "function f(o) { return o.a === 1; }",
    // not paths: a store held whole, its setter, a projection destructured, a memo, a non-delegated store
    `const C = component(function* () { const s = yield* $store({ a: 1 }); ${memoOf("s.a === 1")} });`,
    `const C = component(function* () { const [, setS] = yield* $store({ a: 1 }); ${memoOf("setS.a === 1")} });`,
    `const C = component(function* () { const [q] = yield* $projection(f, {}); ${memoOf("q.a === 1")} });`,
    `const C = component(function* () { const n = yield* $memo(f); ${memoOf("n.a === 1")} });`,
    `const C = component(function* () { const [s] = yield $store({ a: 1 }); ${memoOf("s.a === 1")} });`,
    // not a comparison of identity; not JSON.stringify
    `const C = component(function* () { const [s] = yield* $store({ a: 1 }); ${memoOf("s.a < 1")} });`,
    `const C = component(function* () { const [s] = yield* $store({ a: 1 }); ${memoOf('JSON["stringify"](s)')} });`,
    `const C = component(function* () { const [s] = yield* $store({ a: 1 }); ${memoOf("JSONX.stringify(s)")} });`,
    `const C = component(function* () { const [s] = yield* $store({ a: 1 }); ${memoOf("JSON.parse(s)")} });`,
    `const C = component(function* () { const [s] = yield* $store({ a: 1 }); ${memoOf("stringify(s)")} });`,
    `const C = component(function* () { const [s] = yield* $store({ a: 1 }); ${memoOf("obj.JSON.stringify(s)")} });`
  ],
  invalid: [
    {
      // a defaulted props parameter; == and != too; the path on the right
      code: `const C = component(function* (props = {}) { ${memoOf("props.a == 1 || props.b != 2 || 1 === props.c")} });`,
      errors: [
        { messageId: "compare", data: { text: "props.a" } },
        { messageId: "compare", data: { text: "props.b" } },
        { messageId: "compare", data: { text: "props.c" } }
      ]
    },
    {
      // through TypeScript's wrappers and optional chaining; an optimistic store
      code: `const C = component(function* () { const [s] = yield* $optimisticStore({ a: 1 }); ${memoOf("s! === 1 || (s as any) === 1 || s?.a === 1 || s.a! === 1")} });`,
      errors: [
        { messageId: "compare" },
        { messageId: "compare" },
        { messageId: "compare" },
        { messageId: "compare" }
      ]
    },
    {
      // a long path is shortened in the message
      code: `const C = component(function* () { const [s] = yield* $store({}); ${memoOf("s.aVeryLongKeyNameThatGoesOnAndOnAndOnForever === 1 || s.aKeyNameThatIsExactlyFortyCharsLong123 === 1")} });`,
      errors: [
        { messageId: "compare", data: { text: "s.aVeryLongKeyNameThatGoesOnAndOnAndO..." } },
        { messageId: "compare", data: { text: "s.aKeyNameThatIsExactlyFortyCharsLong123" } }
      ]
    }
  ]
});

describe("the JSX refusals", () => {
  it("say what the transform says", async () => {
    const { REFUSALS: transform } = await import("../../vite-plugin-yield/src/rule.js");
    expect(rules["yield-in-jsx-hole"].meta.messages).toEqual(
      Object.fromEntries(Object.entries(transform).map(([code, m]) => [code, `[${code}] ${m}`]))
    );
  });
});

const TRY = "try { a(); } catch (e) { b(e); }";
tester.run("no-try-catch (edges)", rules["no-try-catch"], {
  valid: [
    TRY,
    `h('p', function () { ${TRY} });`,
    `h('p', function* (x) { ${TRY} });`,
    `wrap(function* () { ${TRY} });`,
    `const m = $memo(function* () { try { a(); } finally { b(); } });`
  ],
  invalid: [
    {
      code: [
        `const C = component(function* () { ${TRY} return function* () { ${TRY} }; });`,
        `const H = $(function* () { ${TRY} });`,
        `const R = <For>{function* (x) { ${TRY} }}</For>;`,
        `const M = $memo(function* () { ${TRY} });`,
        `const E = $effect(function* () { ${TRY} });`,
        `const V = $event(function* () { ${TRY} });`,
        `const B = h('p', function* () { ${TRY} });`
      ].join("\n"),
      errors: [
        "a setup",
        "a view",
        "a hole",
        "a row",
        "a $memo",
        "an $effect",
        "an $event",
        "a hole"
      ].map(where => ({ messageId: "tryCatch", data: { where } }))
    }
  ]
});

const setupRead = body =>
  `const C = component(function* () { ${body} return view(function* () { return <p />; }); });`;
tester.run("no-read-in-setup (edges)", rules["no-read-in-setup"], {
  valid: [
    setupRead("const [n, setN] = yield* $signal(1); const w = yield* setN;"),
    setupRead("const x = yield* other(); const y = yield* x;"),
    setupRead("const [n] = yield* $signal(1); yield n;"),
    setupRead("const y = yield* make();")
  ],
  invalid: [
    {
      code: setupRead(
        "const [o] = yield* $optimistic(1); const v = yield* o; const a = yield* src; const b = yield* a;"
      ),
      errors: [{ messageId: "read" }, { messageId: "read" }]
    }
  ]
});

const viewBody = body =>
  `const C = component(function* () { const [n] = yield* $signal(1); return view(function* () { ${body} }); });`;
tester.run("no-read-in-view-body (edges)", rules["no-read-in-view-body"], {
  valid: [
    viewBody("yield n; return <p />;"),
    viewBody(
      "const s = yield* __nativeSpread(props); const a = yield* __nativeAccessor(n); return <p {...s} />;"
    )
  ],
  invalid: [
    {
      // a view whose body holds an array with a hole, a fragment view, bridges that are not native's
      code: viewBody(
        "const a = [, yield* n]; const b = yield* other(n); const c = yield* ns.__nativeSpread(n); const d = yield* __nativeSpreadX(n); const e = yield* my__nativeAccessor(n); return <></>;"
      ),
      errors: [
        { messageId: "read" },
        { messageId: "read" },
        { messageId: "read" },
        { messageId: "read" },
        { messageId: "read" }
      ]
    }
  ]
});

tester.run("read-before-attempt (edges)", rules["read-before-attempt"], {
  valid: [
    "const m = $memo(function* () { const v = yield* n; yield* attempt(f); return v; });",
    "const m = $memo(function* () { yield* attempt(f); yield x; });",
    "const m = $memo(function* () { const v = yield* n; return v; });"
  ],
  invalid: [
    {
      code: "const m = $memo(function* () { yield* attempt(f); const v = yield* n; yield* attempt(g); return yield* k; });",
      errors: [{ messageId: "after" }, { messageId: "after" }]
    }
  ]
});

const cardDecl = 'import { component } from "solid-yield";\nconst Card = component(f);\n';
const inGen = body => `${cardDecl}function* g() { ${body} }`;
tester.run("no-read-in-prop (edges)", rules["no-read-in-prop"], {
  valid: [
    inGen("Card({ a: yield n });"),
    inGen("Card({ [yield* k]: 1 });"),
    inGen("const o = { a: yield* n };"),
    inGen("Card(x, { a: yield* n });"),
    inGen("card({ a: yield* n });")
  ],
  invalid: [
    {
      // one report per prop
      code: inGen("Card({ a: (yield* n) + (yield* m) });"),
      output: inGen("Card({ a: function* () {\nreturn (yield* n) + (yield* m);\n} });"),
      errors: [{ messageId: "read", data: { key: "a" } }]
    }
  ]
});

const longName =
  'import { component } from "solid-yield";\nconst aVeryLongComponentNameThatKeepsOnGoingAndGoing = component(f);\nconst ANameOfExactlyFortyCharactersLongXYZWVUT = component(f);\n';
tester.run("component-call-yielded (edges)", rules["component-call-yielded"], {
  valid: [
    // a call that is a conditional's test is a value
    inGen("const v = <p>{Card() ? 1 : 2}</p>;"),
    // not in a generator: a root, a thunk
    `${cardDecl}const f = () => <p>{Card()}</p>;`,
    // kept in a variable, or an argument
    inGen("const v = Card(); use(Card());")
  ],
  invalid: [
    {
      // through each wrapper; a statement
      code: inGen(
        "const v = <p>{x && Card()}{Card() as any}{Card()!}{Card() satisfies unknown}{c ? Card() : null}{[Card()]}</p>; Card();"
      ),
      output: inGen(
        "const v = <p>{x && (yield* Card())}{(yield* Card()) as any}{(yield* Card())!}{(yield* Card()) satisfies unknown}{c ? (yield* Card()) : null}{[yield* Card()]}</p>; yield* Card();"
      ),
      errors: Array.from({ length: 7 }, () => ({
        messageId: "unyielded",
        data: { name: "Card" }
      }))
    },
    {
      code:
        longName +
        "function* g() { const v = <p>{aVeryLongComponentNameThatKeepsOnGoingAndGoing()}{ANameOfExactlyFortyCharactersLongXYZWVUT()}</p>; }",
      output:
        longName +
        "function* g() { const v = <p>{yield* aVeryLongComponentNameThatKeepsOnGoingAndGoing()}{yield* ANameOfExactlyFortyCharactersLongXYZWVUT()}</p>; }",
      errors: [
        { messageId: "unyielded", data: { name: "aVeryLongComponentNameThatKeepsOnGoin..." } },
        { messageId: "unyielded", data: { name: "ANameOfExactlyFortyCharactersLongXYZWVUT" } }
      ]
    }
  ]
});

describe("the plugin's documents", () => {
  const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const names = Object.keys(rules);
  it("name every rule", () => {
    const library = read("../../../documentation/yield-library.md");
    const lintTable = library.slice(library.indexOf("## 4. Lint rules"), library.indexOf("## 5."));
    for (const name of names) expect(lintTable).toContain(`| \`${name}\``);
    const refusals = read("../../../documentation/refusals.md");
    for (const name of names) expect(refusals).toContain(`\`${name}\``);
  });
  it("count them as the code does", () => {
    const warnings = Object.values(plugin.configs.recommended.rules).filter(s => s === "warn");
    const pkg = JSON.parse(read("../package.json"));
    expect(pkg.description).toContain(
      `(${names.length} rules; \`recommended\`: ${names.length - warnings.length} errors, ${warnings.length} warnings)`
    );
    expect(read("../../../documentation/refusals.md")).toContain(
      `${names.length} lint rules (${names.length - warnings.length} errors and ${warnings.length} warnings in \`recommended\``
    );
    expect(plugin.meta).toEqual({ name: pkg.name, version: pkg.version });
  });
});

describe("require-jsx-factory without type information", () => {
  // a fresh copy of the plugin: its TypeScript and the projects it reported are module state
  const fresh = async () => {
    vi.resetModules();
    return (await import("../src/index.js")).rules;
  };
  const lint = async (filename, settings = {}) =>
    new Linter({ cwd: "/" }).verify(
      "const a = <>{x}</>;",
      [
        {
          files: ["**/*.tsx", "**/*.js"],
          languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
          plugins: { y: { rules: await fresh() } },
          settings,
          rules: { "y/require-jsx-factory": "warn" }
        }
      ],
      filename
    );
  const fixture = path => fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url));
  it("finds the tsconfig above a nested file, through TypeScript", async () => {
    const [message] = await lint(fixture("edges-no-factory/nested/deeper/file.tsx"));
    expect(message.message).toContain(
      '`"jsxFactory": "jsx"` and `"jsxFragmentFactory": "Fragment"`'
    );
    expect(message.message).toContain(
      relative(process.cwd(), fixture("edges-no-factory/tsconfig.json"))
    );
  });
  it("says nothing for a tsconfig it cannot read, a file it does not check, native mode or no tsconfig", async () => {
    expect(await lint(fixture("edges-bad-config/file.tsx"))).toEqual([]);
    expect(await lint(fixture("edges-no-factory/file.tsx.js"))).toEqual([]);
    expect(
      await lint(fixture("edges-no-factory/file.tsx"), { "solid-yield": { mode: "native" } })
    ).toEqual([]);
    expect(await lint("/nowhere-near-a-tsconfig/file.tsx")).toEqual([]);
  });
});

tester.run("no-unchecked-foreign-handoff (imports)", rules["no-unchecked-foreign-handoff"], {
  valid: [],
  invalid: [
    {
      // the suggestion extends solid-yield's value import, not another module's or a type import
      code: 'import { x } from "other";\nimport type { T } from "solid-yield";\nimport { component } from "solid-yield";\nlet Live = component(f);\ndefineRoute({ component: Live });',
      errors: [
        {
          messageId: "unchecked",
          suggestions: [
            {
              messageId: "wrap",
              output:
                'import { x } from "other";\nimport type { T } from "solid-yield";\nimport { component, foreign } from "solid-yield";\nlet Live = component(f);\ndefineRoute({ component: foreign(Live) });'
            }
          ]
        }
      ]
    }
  ]
});

typedTester.run(
  "no-unchecked-foreign-handoff (internal handoffs, with types)",
  rules["no-unchecked-foreign-handoff"],
  {
    valid: [
      {
        filename,
        code:
          handoffDecls +
          'import { nativeForeign as nf, nativeForeignProvided as np } from "solid-yield/internal";\n' +
          "defineRoute({ path: '/', component: nf(Page) });\ndefineRoute({ path: '/a', component: np(Page, null) });"
      },
      {
        // Solid's other APIs are not lazy; a default export that is a plain function is not a component
        filename,
        code:
          handoffDecls +
          'declare const Plain: () => { x: 1 };\nimport { createResource, lazy } from "solid-js";\nconst r = createResource(() => Promise.resolve({ default: Page }));\nconst L = lazy(() => Promise.resolve({ default: Plain }));'
      }
    ],
    invalid: [
      {
        filename,
        code:
          handoffDecls +
          'import { nativeOther as no } from "solid-yield/internal";\n' +
          "defineRoute({ path: '/', component: no(Page) });",
        errors: [{ messageId: "unchecked", suggestions: 1 }]
      }
    ]
  }
);

const opDecls = `
interface Yieldable<Y, R> { [Symbol.iterator](): Generator<Y, R, any>; }
interface Receipt<T> { readonly receipt: T }
interface EventCall<R> extends Promise<R>, Yieldable<unknown, R> { readonly __call: true }
interface Saved extends EventCall<void> { readonly saved: true }
interface Base { readonly base: true }
interface Left extends Base { readonly left: true }
interface Right extends Base { readonly right: true }
declare function $event<A extends unknown[]>(f: (...a: A) => Generator<unknown, unknown, unknown>): (...a: A) => EventCall<void>;
declare function write(): Receipt<number>;
declare function go(): Saved;
declare function either(): Left | Right;
`;
typedTester.run("no-unyielded-write (operation types)", rules["no-unyielded-write"], {
  valid: [
    // a union of two plain types sharing a base is no operation
    { filename, code: opDecls + "const e = $event(function* () { either(); });" }
  ],
  invalid: [
    {
      // a receipt; an interface extending an event call
      filename,
      code:
        opDecls +
        "const e = $event(function* () { write(); go(); }); const C = component(function* () { for (const [a, setA] of pairs) setA(1); });",
      errors: [
        { messageId: "discarded", data: { name: "write" } },
        { messageId: "discarded", data: { name: "go" } }
      ]
    }
  ]
});

tester.run("no-path-object-use (defaulted parameters)", rules["no-path-object-use"], {
  valid: [
    `const C = component(function* (first = {}, second = {}) { ${memoOf("second.x === 1")} });`
  ],
  invalid: []
});

const typedCard = `
declare const COMPONENT: unique symbol;
interface View { readonly [COMPONENT]: true }
declare const ui: { Card: (props: {}) => View };
`;
typedTester.run("no-component-tag (member tags, with types)", rules["no-component-tag"], {
  valid: [],
  invalid: [
    {
      filename,
      code: typedCard + "function* v() { return <p><ui.Card /></p>; }",
      output: typedCard + "function* v() { return <p>{yield* ui.Card()}</p>; }",
      errors: [{ messageId: "tag", data: { name: "ui.Card" } }]
    }
  ]
});

tester.run("no-component-tag (lazy view children)", rules["no-component-tag"], {
  valid: [],
  invalid: [
    {
      // a lazy view (no row) needs no view import
      code: tagImports + inRoutine("<p><Show when={x}><i /></Show></p>"),
      output:
        tagImports +
        inRoutine("<p>{yield* Show({ when: x, children: function* () {\nreturn <i />;\n} })}</p>"),
      errors: [{ messageId: "tag" }]
    }
  ]
});

tester.run("component-children-generator (statements)", rules["component-children-generator"], {
  valid: [
    { filename: "app.js", code: flow + "For({ each: xs, children: (x) => { throw <p />; } });" },
    {
      filename: "app.ts",
      code: flow + "For({ each: xs, children: (x) => { return h('li', x); } });"
    }
  ],
  invalid: []
});

typedTester.run("no-unshown-wait (names)", rules["no-unshown-wait"], {
  valid: [{ filename, code: waitDecls + 'f("b", { onClick: waits });' }],
  invalid: [
    {
      filename,
      code:
        waitDecls +
        "declare const anEventHandlerNameOfExactlyFortyChars123: typeof waits;\nfunction* v() { return <b onClick={yield* anEventHandlerNameOfExactlyFortyChars123} />; }",
      errors: [{ messageId: "wait", data: { name: "anEventHandlerNameOfExactlyFortyChars123" } }]
    }
  ]
});
