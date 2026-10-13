const test = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { makeHost, root, ts } = require("./helpers.cjs");
const init = require("../src/plugin.cjs");

// The editor entry: tsserver loads the plugin and calls `create` with its
// language service; the proxy answers diagnostics and hovers from the native
// check and keeps every other method the language service's own.
const source = `import { createMemo } from "solid-js";
import { render } from "@solidjs/web";
export function App() {
  const n = createMemo(async () => 1);
  return <p>{n()}</p>;
}
render(App, document.body);
`;
test("the editor plugin answers through the native check", () => {
  const host = makeHost({ "plugin.tsx": source });
  const languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
  const proxy = init({ typescript: ts }).create({
    languageService,
    languageServiceHost: host,
    config: { mode: "native", include: ["*.tsx"] }
  });
  const file = join(root, "plugin.tsx");
  try {
    const codes = proxy
      .getSemanticDiagnostics(file)
      .map(d => /\[([A-Z_]+)\]/.exec(ts.flattenDiagnosticMessageText(d.messageText, "\n"))?.[1]);
    assert.deepEqual(codes, ["PENDING_ROOT"]);
    assert.deepEqual(proxy.getSyntacticDiagnostics(file), []);
    assert.ok(Array.isArray(proxy.getSuggestionDiagnostics(file)));
    // not overridden: the language service's own, bound to it
    assert.equal(proxy.getProgram(), languageService.getProgram());
    // a component's hover shows its colors
    const component = proxy.getQuickInfoAtPosition(file, source.indexOf("function App") + 9);
    assert.match(component.displayParts.map(p => p.text).join(""), /can suspend \(pending\)/);
    // a source hovers with its colors
    const accessor = proxy.getQuickInfoAtPosition(file, source.indexOf("const n") + 6);
    assert.match(accessor.displayParts.map(p => p.text).join(""), /^n — can suspend \(pending\)/);
    // a call the lowering replaced (`render` is the library's root check)
    // hovers as the original source types it, never with generated types
    const call = proxy.getQuickInfoAtPosition(file, source.indexOf("render(App") + 2);
    const text = call.displayParts.map(p => p.text).join("");
    assert.doesNotMatch(text, /Generator|RootCheck|HoleCall|__@|__native/);
    assert.match(text, /render\(code: \(\) => JSX\.Element, element: MountableElement/);
    // plain code hovers as the language service answers it
    const plain = proxy.getQuickInfoAtPosition(file, source.indexOf("document.body") + 2);
    assert.equal(plain.displayParts.map(p => p.text).join(""), "var document: Document");
  } finally {
    proxy.dispose();
  }
});
