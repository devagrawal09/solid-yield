import { afterEach, expect, inject, it } from "vitest";
import { flush } from "solid-js";
import { hydrate } from "solid-yield";
import { App } from "./app.js";
declare module "vitest" {
  export interface ProvidedContext {
    docsHydration: Record<"string" | "stream", string>;
  }
}
let dispose: (() => void) | undefined;
afterEach(async () => {
  dispose?.();
  dispose = undefined;
  await Promise.resolve();
  delete (globalThis as any)._$HY;
  document.body.replaceChildren();
});
it.each(["string", "stream"] as const)(
  "hydrates %s output and keeps its interactive server node",
  async kind => {
    document.body.innerHTML = inject("docsHydration")[kind];
    for (const script of [...document.body.querySelectorAll("script")]) {
      (0, eval)(script.textContent!);
      script.remove();
    }
    const root = document.getElementById("app")!;
    const before = root.querySelector("button")!;
    dispose = hydrate(App, root);
    flush();
    await Promise.resolve();
    flush();
    expect(root.querySelector("button")).toBe(before);
    before.click();
    flush();
    expect(before.textContent).toBe("1");
  }
);
