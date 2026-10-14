import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import {
  routineKind,
  kindAt,
  enclosingFunction,
  isViewCall,
  jsxPosition,
  isCallTo,
  isCapitalizedCall
} from "../src/routines.js";

// What the rules share (routines.js): which generator is which routine, and
// where a node sits in JSX. Each case is a position the rules tell apart.

/** Runs `visit(node)` on each node `selector` matches; returns what it returned. */
const probe = (code, selector, visit) => {
  const out = [];
  const plugin = {
    rules: { probe: { create: () => ({ [selector]: node => void out.push(visit(node)) }) } }
  };
  const messages = new Linter().verify(
    code,
    [
      {
        files: ["**/*.tsx"],
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
          ecmaVersion: 2024,
          sourceType: "module"
        },
        plugins: { p: plugin },
        rules: { "p/probe": "error" }
      }
    ],
    { filename: "file.tsx" }
  );
  expect(messages.filter(m => m.fatal)).toEqual([]);
  return out;
};
/** The kind of the generator named `T`. */
const kind = code => {
  const [k] = probe(code, ":function[id.name='T']", routineKind);
  return k;
};
const setup = body => `const C = component(function* () { ${body} });`;

describe("routineKind", () => {
  it("a constructor's argument is its routine", () => {
    expect(kind("component(function* T() {});")).toBe("setup");
    expect(kind("$memo(function* T() {});")).toBe("memo");
    expect(kind("$effect(function* T() {});")).toBe("effect");
    expect(kind("$event(function* T() {});")).toBe("event");
    expect(kind("$scope(function* T(x) {});")).toBe("row");
    expect(kind("lib.$memo(function* T() {});")).toBe("memo");
  });
  it("a `$` block is a hole, or a row with parameters", () => {
    expect(kind("$(function* T() {});")).toBe("hole");
    expect(kind("$(function* T(x) {});")).toBe("row");
  });
  it("an effect's second phase is an effect; another second argument is not a routine", () => {
    expect(kind("$effect(function* () {}, function* T() {});")).toBe("effect");
    expect(kind("$memo(x, function* T() {});")).toBe(null);
    expect(kind("$effect(a, b, function* T() {});")).toBe(null);
    expect(kind("other(x, function* T() {});")).toBe(null);
  });
  it("an unknown or computed callee is not a constructor", () => {
    expect(kind("other(function* T() {});")).toBe(null);
    expect(kind('lib["$memo"](function* T() {});')).toBe(null);
    expect(kind("make()(function* T() {});")).toBe(null);
  });
  it("a generator returned by a setup or a row's setup is its view", () => {
    expect(kind(setup("return function* T() {};"))).toBe("view");
    expect(kind(setup("return view(function* T() {});"))).toBe("view");
    expect(kind(setup("return c ? function* T() {} : function* () {};"))).toBe("view");
    expect(kind(setup("return c && function* T() {};"))).toBe("view");
    expect(kind(setup("return (log(), function* T() {});"))).toBe("view");
    expect(kind("const v = <For>{function* (x) { return function* T() {}; }}</For>;")).toBe("view");
  });
  it("not when the setup returns something else holding it, or another routine returns it", () => {
    expect(kind(setup("return wrap(function* T() {});"))).toBe(null);
    expect(kind(setup("return view(other, function* T() {});"))).toBe(null);
    expect(kind(setup("use(function* T() {}); return null;"))).toBe(null);
    expect(kind("$memo(function* () { return function* T() {}; });")).toBe(null);
    expect(kind("function f() { return function* T() {}; }")).toBe(null);
  });
  it("a render callback in JSX is a row", () => {
    expect(kind("const v = <For each={xs}>{function* T(x) {}}</For>;")).toBe("row");
    expect(kind("const v = <p>{function* T() {}}</p>;")).toBe("row");
  });
  it("a direct call's children or fallback: a row with parameters, else a view", () => {
    expect(kind("For({ each: xs, children: function* T(x) {} });")).toBe("row");
    expect(kind("Show({ when: c, children: function* T() {} });")).toBe("view");
    expect(kind("Errored({ fallback: function* T() {} });")).toBe("view");
    expect(
      probe("For({ *children(x) {} });", "Property > FunctionExpression", routineKind)
    ).toEqual(["row"]);
    expect(kind("For({ other: function* T() {} });")).toBe(null);
    expect(kind('For({ ["children"]: function* T() {} });')).toBe(null);
    expect(kind('For({ "children": function* T() {} });')).toBe(null);
  });
  it("a generator declared in a setup or a row returning its view is a row", () => {
    expect(kind(setup("function* T(x) { return function* () {}; }"))).toBe("row");
    expect(kind(setup("function* T(x) { return view(function* () {}); }"))).toBe("row");
    expect(kind(setup("function* T(x) { if (x) { return function* () {}; } }"))).toBe("row");
    expect(
      kind("const v = <For>{function* (y) { function* T(x) { return function* () {}; } }}</For>;")
    ).toBe("row");
  });
  it("not one returning a value, a nested function's view, or declared elsewhere", () => {
    expect(kind(setup("function* T(x) { return 1; }"))).toBe(null);
    expect(kind(setup("function* T(x) { return; }"))).toBe(null);
    expect(kind(setup("function* T(x) { return function () {}; }"))).toBe(null);
    expect(kind(setup("function* T(x) { const f = () => { return function* () {}; }; }"))).toBe(
      null
    );
    expect(kind("$memo(function* () { function* T(x) { return function* () {}; } });")).toBe(null);
    expect(kind("function* T(x) { return function* () {}; }")).toBe(null);
  });
  it("a generator bound to a const in a setup, with parameters, returning a view is a row", () => {
    expect(kind(setup("const T = function* T(x) { return function* () {}; };"))).toBe("row");
    expect(kind(setup("const T = function* T() { return function* () {}; };"))).toBe(null);
    expect(kind(setup("const T = function* T(x) { return x; };"))).toBe(null);
    expect(
      kind("$memo(function* () { const T = function* T(x) { return function* () {}; }; });")
    ).toBe(null);
    expect(kind(setup("let T; T = function* T(x) { return function* () {}; };"))).toBe(null);
    expect(
      kind(
        "const v = <For>{function* (y) { const T = function* T(x) { return function* () {}; }; }}</For>;"
      )
    ).toBe("row");
    expect(kind(setup("function* T(x) { throw function* () {}; }"))).toBe(null);
  });
  it("a plain function is no routine, and the kind is the same when asked again", () => {
    expect(probe("component(function T() {});", ":function[id.name='T']", routineKind)).toEqual([
      null
    ]);
    expect(routineKind(null)).toBe(null);
    expect(
      probe("$memo(function* T() {});", ":function[id.name='T']", fn => [
        routineKind(fn),
        routineKind(fn)
      ])
    ).toEqual([["memo", "memo"]]);
  });
});

describe("kindAt and enclosingFunction", () => {
  it("the kind of the nearest function, through arrows and declarations", () => {
    expect(
      probe(
        "$memo(function* () { x; const f = () => y; function g() { z; } }); w;",
        "Identifier[name=/^[xyzw]$/]",
        node => [kindAt(node), enclosingFunction(node)?.type ?? null]
      )
    ).toEqual([
      ["memo", "FunctionExpression"],
      [null, "ArrowFunctionExpression"],
      [null, "FunctionDeclaration"],
      [null, null]
    ]);
  });
});

describe("jsxPosition", () => {
  const at = code => probe(code, "Identifier[name='x']", jsxPosition)[0];
  it("a child, an attribute (namespaced too), a spread", () => {
    expect(at("const v = <p>{x}</p>;")).toEqual({ hole: "child" });
    expect(at("const v = <p class={x} />;")).toEqual({ hole: "attribute", name: "class" });
    expect(at("const v = <p on:click={x} />;")).toEqual({ hole: "attribute", name: "on:click" });
    expect(at("const v = <p {...x} />;")).toEqual({ hole: "spread" });
    expect(at("const v = <p>{...x}</p>;")).toEqual({ hole: "spread-child" });
    expect(at("const v = <p>{f(x.y)}</p>;")).toEqual({ hole: "child" });
  });
  it("not past a function or a class, nor outside JSX", () => {
    expect(at("const v = <p>{() => x}</p>;")).toBe(null);
    expect(at("const v = <p>{class { static y = x; }}</p>;")).toBe(null);
    expect(at("const v = x;")).toBe(null);
  });
});

describe("call shapes", () => {
  const call = (code, test) => probe(code, "ExpressionStatement > CallExpression", test)[0];
  it("isViewCall: a call to `view` by name", () => {
    expect(call("view(f);", isViewCall)).toBe(true);
    expect(call("lib.view(f);", isViewCall)).toBe(false);
    expect(call("views(f);", isViewCall)).toBe(false);
    expect(isViewCall(null)).toBe(false);
    expect(probe("view;", "ExpressionStatement > Identifier", isViewCall)).toEqual([false]);
  });
  it("isCallTo: by name or member name", () => {
    expect(call("$memo(f);", n => isCallTo(n, ["$memo"]))).toBe(true);
    expect(call("lib.$memo(f);", n => isCallTo(n, ["$memo"]))).toBe(true);
    expect(call("$memo(f);", n => isCallTo(n, ["$event"]))).toBe(false);
    expect(
      probe("$memo;", "ExpressionStatement > Identifier", n => isCallTo(n, ["$memo"]))
    ).toEqual([false]);
  });
  it("isCapitalizedCall: a capitalized name or member name", () => {
    expect(call("Card();", isCapitalizedCall)).toBe(true);
    expect(call("ui.Card();", isCapitalizedCall)).toBe(true);
    expect(call("card();", isCapitalizedCall)).toBe(false);
    expect(call("ui[Card]();", isCapitalizedCall)).toBe(false);
    expect(call("make()();", isCapitalizedCall)).toBe(false);
    expect(isCapitalizedCall(null)).toBe(false);
  });
});
