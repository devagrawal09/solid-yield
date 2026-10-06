import { flush, resetErrorHalt } from "solid-js";
import { render } from "solid-yield";
import {
  frozenAbsorbed,
  DefaultReader,
  ForeignRoot,
  FragmentReader,
  ShapeCaught,
  WidenedHandler,
  UnknownProp,
  EagerEffect,
  UndefinedProvided,
  HRowLoss,
  ForeignPendingRoot
} from "./counterexamples.js";

beforeEach(() => resetErrorHalt());
afterEach(() => {
  resetErrorHalt();
  vi.restoreAllMocks();
});

for (const [name, App, message] of [
  ["D-102: a false provided claim", ForeignRoot, /NO_PROVIDER|context/i],
  ["undefined default", DefaultReader, /NO_PROVIDER|context/i],
  ["h row loses its setup requirements", HRowLoss, /NO_PROVIDER|context/i],
  ["unknown context allows undefined provider", UndefinedProvided, /NO_PROVIDER|context/i],
  ["h.Fragment loses its child's requirement", FragmentReader, /NO_PROVIDER|context/i],
  ["structural error is not instanceof its declared class", ShapeCaught, /object Object/],
  ["unknown handler result drops a branded failure", WidenedHandler, /widened handler/],
  ["unknown prop swallows a source color", UnknownProp, /unknown prop/],
  ["eager effect is outside h Errored", EagerEffect, /BOUNDARY_CONTENT_BUILT|eager effect/]
] as const) {
  it(name, () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const root = document.createElement("div");
    expect(() => {
      render(App, root);
      flush();
    }).toThrow(message);
  });
}

it("a frozen raised error bypasses an absorbing attempt over a call", async () => {
  await expect(frozenAbsorbed()).rejects.toMatchObject({ kind: "proof-boom" });
});

it("foreign pending may cross an unchecked plain-Solid tag with no Loading", () => {
  const root = document.createElement("div");
  const dispose = render(ForeignPendingRoot, root);
  flush();
  expect(root.textContent).toBe("");
  dispose();
});
