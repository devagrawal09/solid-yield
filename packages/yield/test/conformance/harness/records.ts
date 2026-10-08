import vm from "node:vm";

/**
 * Executes a rendered payload's <script> blocks the way a browser would and
 * returns the record ids filed under `_$HY.r` — the serialized record SET by
 * protocol outcome rather than by scraping assignment text. (From the Solid
 * fork's `packages/web/test/harness/hydration-records.ts`.)
 *
 * `document.getElementById` returns null so `$df` reveal calls take their
 * graceful "template not present" early return instead of touching a DOM.
 */
export function hydrationRecordKeys(html: string): string[] {
  const sandbox: any = {
    document: { getElementById: () => null, addEventListener() {} },
    _$HY: { r: {}, fe() {} }
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  for (const [, src] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(src, sandbox);
  }
  const keys = Object.keys(sandbox._$HY.r);
  // Error-path payloads reject their record promises (the protocol for
  // streamed errors); without a consumer that leaks an unhandled rejection.
  for (const k of keys) {
    const p = sandbox._$HY.r[k];
    if (p && typeof p.then === "function") p.catch(() => {});
  }
  return keys;
}
