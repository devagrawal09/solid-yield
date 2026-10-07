import { describe, it, expect } from "vitest";
import {
  nativeFailure,
  nativeFailureValue,
  registerNativeFailure,
  NativeFailure
} from "../src/native-failure.js";
import { ChunkError } from "../src/lazy.js";
describe("native failure adapters", () => {
  it("preserves same-realm identity without mutating the author error", () => {
    class E extends Error {}
    registerNativeFailure("module#E", E);
    const original = Object.freeze(new E("safe message"));
    const caught = nativeFailure(["module#E"], original);
    expect(caught.kind).toBe("module#E");
    expect(caught).toBeInstanceOf(NativeFailure);
    expect(nativeFailureValue(caught)).toBe(original);
    expect(nativeFailureValue(caught)).toBeInstanceOf(E);
  });
  it("separates same-named classes and accepts non-class unknown throws", () => {
    const A = class E extends Error {};
    const B = class E extends Error {};
    registerNativeFailure("a#E", A);
    registerNativeFailure("b#E", B);
    expect(nativeFailure(["a#E", "b#E"], new B()).kind).toBe("b#E");
    expect(nativeFailure(["unknown"], "bad").value).toBe("bad");
    expect(() => nativeFailure(["a#E"], new B())).toThrow("NATIVE_FAILURE_CONTRACT");
  });
  it("keeps the transport class and reconstructs serialized declared failures", () => {
    const transport = new ChunkError("offline");
    expect(nativeFailure(["ChunkError"], transport, ChunkError)).toBe(transport);
    expect(nativeFailure(["ChunkError"], new Error("offline"), ChunkError)).toBeInstanceOf(
      ChunkError
    );
    const wire = JSON.parse(JSON.stringify(nativeFailure(["global:Error"], new Error("safe"))));
    const restored = nativeFailure(["global:Error", "ChunkError"], wire);
    expect(restored.kind).toBe("global:Error");
    expect(nativeFailureValue(restored)).not.toBeInstanceOf(Error);
  });
});
