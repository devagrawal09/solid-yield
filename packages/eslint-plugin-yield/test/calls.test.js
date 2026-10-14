import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { fileURLToPath } from "node:url";
import {
  isYieldComponent,
  enclosingFn,
  containsYield,
  propValue,
  childrenFromFunction,
  childrenFromJsx,
  inGenerator,
  importView
} from "../src/calls.js";

// The helpers the component rules share (calls.js), each case a behavior a
// rule's report or fix depends on.

/** Runs `visit(context, node)` on each node `selector` matches; returns what it returned. */
const probe = (code, selector, visit, parserOptions = {}, filename = "file.tsx") => {
  const out = [];
  const plugin = {
    rules: {
      probe: {
        create: context => ({ [selector]: node => void out.push(visit(context, node)) })
      }
    }
  };
  const messages = new Linter().verify(
    code,
    [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true }, ...parserOptions },
          ecmaVersion: 2024,
          sourceType: "module"
        },
        plugins: { p: plugin },
        rules: { "p/probe": "error" }
      }
    ],
    { filename }
  );
  expect(messages.filter(m => m.fatal)).toEqual([]);
  return out;
};
const first = (code, selector, visit) => probe(code, selector, visit)[0];
const text = (context, node) => context.sourceCode.getText(node);

describe("isYieldComponent without types", () => {
  const named = (code, name) =>
    probe(code, `JSXOpeningElement > JSXIdentifier[name="${name}"]`, isYieldComponent)[0];
  it.each(["For", "Show", "Switch", "Match", "Repeat", "Loading", "Errored"])(
    "an undeclared %s is the library's flow control",
    name => expect(named(`const v = <${name} />;`, name)).toBe(true)
  );
  it("an undeclared other tag is not known", () => {
    expect(named("const v = <Panel />;", "Panel")).toBe(false);
  });
  it("an import from solid-yield is one, a type import or another module's is not", () => {
    expect(named('import { Card } from "solid-yield";\nconst v = <Card />;', "Card")).toBe(true);
    expect(named('import type { Card } from "solid-yield";\nconst v = <Card />;', "Card")).toBe(
      false
    );
    expect(named('import { Card } from "./card";\nconst v = <Card />;', "Card")).toBe(false);
  });
  it("a binding to component(…) or lazy(…) is one; other bindings are not", () => {
    expect(named("const Card = component(f);\nconst v = <Card />;", "Card")).toBe(true);
    expect(named("const Card = lazy(f);\nconst v = <Card />;", "Card")).toBe(true);
    expect(named("const Card = make(f);\nconst v = <Card />;", "Card")).toBe(false);
    expect(named("const Card = lib.component(f);\nconst v = <Card />;", "Card")).toBe(false);
    expect(named("const Card = f;\nconst v = <Card />;", "Card")).toBe(false);
    expect(named("let Card;\nconst v = <Card />;", "Card")).toBe(false);
    expect(named("function Card() {}\nconst v = <Card />;", "Card")).toBe(false);
  });
  it("a member tag has no name of its own", () => {
    expect(
      first("const v = <ui.Card />;", "JSXOpeningElement > JSXMemberExpression", isYieldComponent)
    ).toBe(false);
  });
  it("an identifier in a call is resolved as a tag is", () => {
    expect(
      first("const v = Show({ when: 1 });", "CallExpression > Identifier.callee", isYieldComponent)
    ).toBe(true);
  });
});

describe("isYieldComponent with types", () => {
  const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));
  const typed = code =>
    probe(
      code,
      "CallExpression > Identifier.callee",
      (context, node) => [node.name, isYieldComponent(context, node)],
      { projectService: true, tsconfigRootDir: fixtures },
      `${fixtures}/file.tsx`
    );
  const decls = `
declare const COMPONENT: unique symbol;
interface View { readonly [COMPONENT]: true }
interface Other { readonly other: true }
declare function Card(props: {}): View;
declare function Plain(props: {}): Other;
declare const Either: ((p: {}) => View) | ((p: {}) => Other);
declare const Neither: ((p: {}) => Other) | ((p: {}) => number);
declare const Mixed: (p: {}) => View | Other;
declare const Overloaded: { (p: {}): Other; (p: { x: 1 }): View };
declare const value: number;
`;
  it("is one when a call signature returns a view marked [COMPONENT]", () => {
    expect(
      typed(
        `${decls}Card({}); Plain({}); Either({}); Neither({}); Mixed({}); Overloaded({}); (value as any)();`
      )
    ).toEqual([
      ["Card", true],
      ["Plain", false],
      ["Either", true],
      ["Neither", false],
      ["Mixed", true],
      ["Overloaded", true]
    ]);
  });
});

describe("enclosingFn and inGenerator", () => {
  it("finds the nearest function of any kind", () => {
    const fns = probe(
      "function* g() { const a = () => x; }\nconst e = function () { y; };\nfunction d() { z; }\nw;",
      "Identifier[name=/^[xyzw]$/]",
      (_c, node) => enclosingFn(node)?.type ?? null
    );
    expect(fns).toEqual([
      "ArrowFunctionExpression",
      "FunctionExpression",
      "FunctionDeclaration",
      null
    ]);
  });
  it("a node under an arrow in a generator is not in a generator", () => {
    expect(
      probe("function* g() { x; const a = () => y; }", "Identifier[name=/^[xy]$/]", (_c, node) =>
        inGenerator(node)
      )
    ).toEqual([true, false]);
  });
});

describe("containsYield", () => {
  const yields = code =>
    first(`function* g() { const v = ${code}; }`, "VariableDeclarator > .init", (_c, node) =>
      containsYield(node)
    );
  it("finds a yield anywhere in the expression", () => {
    expect(yields("yield* a")).toBe(true);
    expect(yields("f(1, yield* a)")).toBe(true);
    expect(yields("[1, [2, yield* a]]")).toBe(true);
    expect(yields("{ k: { j: yield* a } }")).toBe(true);
    expect(yields("(yield* a) + 1")).toBe(true);
  });
  it("not in a nested function, nor where there is none", () => {
    expect(yields("[function* () { yield* a; }, b]")).toBe(false);
    expect(yields("f(a, b.c, [d])")).toBe(false);
    expect(yields("null")).toBe(false);
  });
  it("a function's own body counts when the function is the node", () => {
    expect(
      first("const f = function* () { yield* a; };", "VariableDeclarator > .init", (_c, node) =>
        containsYield(node)
      )
    ).toBe(true);
  });
});

describe("propValue", () => {
  const prop = code =>
    first(`function* g() { const v = ${code}; }`, "VariableDeclarator > .init", (c, node) =>
      propValue(c.sourceCode, node)
    );
  it("a function is passed as it is", () => {
    expect(prop("function* () { return yield* a; }")).toBe("function* () { return yield* a; }");
    expect(prop("(x) => x")).toBe("(x) => x");
  });
  it("a delegated source or path is the source itself", () => {
    expect(prop("yield* count")).toBe("count");
    expect(prop("yield* todo.title")).toBe("todo.title");
  });
  it("any other read is a hole", () => {
    const hole = body => `function* () {\nreturn ${body};\n}`;
    expect(prop("yield* matches('x')")).toBe(hole("yield* matches('x')"));
    expect(prop("yield count")).toBe(hole("yield count"));
    expect(prop("(yield* count) + 1")).toBe(hole("(yield* count) + 1"));
  });
  it("a settled value is passed as it is", () => {
    expect(prop("count + 1")).toBe("count + 1");
  });
});

describe("childrenFromFunction", () => {
  const children = code =>
    first(`const v = ${code};`, "VariableDeclarator > .init", (c, node) =>
      childrenFromFunction(c.sourceCode, node)
    );
  it("a generator is passed as it is", () => {
    expect(children("function* (x) { return x; }")).toBe("function* (x) { return x; }");
  });
  it("a callback returning JSX is a lazy view, or a row with parameters", () => {
    expect(children("() => <p />")).toBe("function* () {\nreturn <p />;\n}");
    expect(children("() => <><p /></>")).toBe("function* () {\nreturn <><p /></>;\n}");
    expect(children("(x, i) => <li>{x}</li>")).toBe(
      "function* (x, i) {\nreturn view(function* () {\nreturn <li>{x}</li>;\n});\n}"
    );
    expect(children("function () { return <p />; }")).toBe("function* () {\nreturn <p />;\n}");
    expect(children("() => (<p /> as any)")).toBe("function* () {\nreturn <p />;\n}");
  });
  it("a call is delegated to, anything else held in a fragment", () => {
    expect(children("() => Card()")).toBe("function* () {\nreturn <>{yield* Card()}</>;\n}");
    expect(children("() => label")).toBe("function* () {\nreturn <>{label}</>;\n}");
  });
  it("a body that is more than its return cannot be fixed", () => {
    expect(children("() => { log(); return <p />; }")).toBe(null);
    expect(children("() => { return; }")).toBe(null);
    expect(children("() => { log(); }")).toBe(null);
    expect(children("() => {}")).toBe(null);
    expect(children("() => { throw label; }")).toBe(null);
  });
});

describe("childrenFromJsx", () => {
  const children = code =>
    first(code, "JSXElement[openingElement.name.name='T']", (c, node) =>
      childrenFromJsx(c.sourceCode, node.children)
    );
  it("whitespace and comments are not children", () => {
    expect(children("const v = <T>\n  </T>;")).toBe(undefined);
    expect(children("const v = <T>{/* note */}</T>;")).toBe(undefined);
    expect(children("const v = <T> {/* note */} <p /> </T>;")).toBe(
      "function* () {\nreturn <p />;\n}"
    );
  });
  it("a function child is converted as a function", () => {
    expect(children("const v = <T>{(x) => <li>{x}</li>}</T>;")).toBe(
      "function* (x) {\nreturn view(function* () {\nreturn <li>{x}</li>;\n});\n}"
    );
    expect(children("const v = <T>{function () { return <p />; }}</T>;")).toBe(
      "function* () {\nreturn <p />;\n}"
    );
  });
  it("a named row is passed as it is; a component's view is delegated to", () => {
    expect(children("const v = <T>{row}</T>;")).toBe("row");
    expect(children("const v = <T>{Card()}</T>;")).toBe(
      "function* () {\nreturn <>{yield* Card()}</>;\n}"
    );
  });
  it("other expressions and several children are held in a fragment", () => {
    expect(children("const v = <T>{card()}</T>;")).toBe("function* () {\nreturn <>{card()}</>;\n}");
    expect(children("const v = <T>{ui.Card()}</T>;")).toBe(
      "function* () {\nreturn <>{ui.Card()}</>;\n}"
    );
    expect(children("const v = <T>{a + b}</T>;")).toBe("function* () {\nreturn <>{a + b}</>;\n}");
    expect(children("const v = <T>\n  <p />\n  <b />\n</T>;")).toBe(
      "function* () {\nreturn <><p />\n  <b /></>;\n}"
    );
    expect(children("const v = <T>hello</T>;")).toBe("function* () {\nreturn <>hello</>;\n}");
    expect(children("const v = <T><p />{x}</T>;")).toBe("function* () {\nreturn <><p />{x}</>;\n}");
    expect(children("const v = <T>{row}<b /></T>;")).toBe(
      "function* () {\nreturn <>{row}<b /></>;\n}"
    );
    expect(children("const v = <T>{makeCard()}</T>;")).toBe(
      "function* () {\nreturn <>{makeCard()}</>;\n}"
    );
  });
});

describe("importView", () => {
  const fixer = { insertTextAfter: (node, added) => ({ after: node.local.name, added }) };
  const fix = code => first(code, "Program", context => importView(context, fixer));
  it("adds view after the last named import of solid-yield", () => {
    expect(fix('import { a, b } from "solid-yield";')).toEqual({ after: "b", added: ", view" });
    expect(fix('import Y, { a } from "solid-yield";')).toEqual({ after: "a", added: ", view" });
    expect(fix('import type { T } from "solid-yield";\nimport { a } from "solid-yield";')).toEqual({
      after: "a",
      added: ", view"
    });
  });
  it("nothing when view is imported, or there is no named import to extend", () => {
    expect(fix('import { a, view } from "solid-yield";')).toBe(null);
    expect(fix('import * as Y from "solid-yield";')).toBe(null);
    expect(fix('import Y from "solid-yield";')).toBe(null);
    expect(fix('import type { T } from "solid-yield";')).toBe(null);
    expect(fix('import { a } from "solid-js";')).toBe(null);
    expect(fix("const a = 1;")).toBe(null);
  });
  it("a view imported under another name is not view", () => {
    expect(fix('import { view as v } from "solid-yield";')).toEqual({
      after: "v",
      added: ", view"
    });
  });
});
