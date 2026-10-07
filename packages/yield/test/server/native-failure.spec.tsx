import { it, expect, vi } from "vitest";
import { component, $memo, attempt, view, Loading, renderToStream } from "solid-yield";
import { nativeFailure, registerNativeFailure } from "../../src/native-failure.js";
it("keeps native class identity and safe message in the stream", async () => {
  class Rejected extends Error {}
  registerNativeFailure("fixture#Rejected", Rejected);
  const App = component(function* () {
    const value = yield* $memo(function* () {
      return yield* attempt(
        () => Promise.reject(new Rejected("author message")),
        e => nativeFailure(["fixture#Rejected"], e)
      );
    });
    return view(function* () {
      return <p>{yield* value}</p>;
    });
  });
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const html = await new Promise<string>(resolve => {
      const chunks: string[] = [];
      renderToStream(() => Loading({ fallback: "loading", children: App }), {
        manifest: {}
      } as any).pipe({
        write(c: string) {
          chunks.push(c);
        },
        end() {
          resolve(chunks.join(""));
        }
      });
    });
    expect(html).toContain('name:"NativeFailure"');
    expect(html).toContain('kind:"fixture#Rejected"');
    expect(html).toContain("author message");
  } finally {
    error.mockRestore();
    warn.mockRestore();
  }
});
