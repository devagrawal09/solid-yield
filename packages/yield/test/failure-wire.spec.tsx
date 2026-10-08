import { flush } from "solid-js";
import { isSafeError } from "@solidjs/web";
import {
  Failure,
  registerFailure,
  failureClass,
  rehydrateFailure,
  prepareFailure,
  attempt,
  $event,
  $memo,
  component,
  Errored,
  Loading,
  raise,
  render,
  view
} from "solid-yield";

class Missing extends Failure("missing") {
  detail = "public detail";
  describe() {
    return this.detail;
  }
}
class DeepMissing extends Missing {}
// Deliberately the same kind: runtime coverage must use the class, not kind.
class Sibling extends Failure("missing") {
  sibling = true;
}
registerFailure(Missing, "wire-test/Missing");
registerFailure(DeepMissing, "wire-test/DeepMissing");
registerFailure(Sibling, "wire-test/Sibling");

const decode = (error: Error) =>
  Object.assign(new Error(error.message), JSON.parse(JSON.stringify(error)));
const settle = async () => {
  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 0));
    flush();
  }
};

describe("failure wire identity (D-117)", () => {
  it("restores subclasses without constructing them; keeps public props and safe marking", () => {
    const original = new DeepMissing("public message");
    const decoded = decode(original);
    expect(decoded instanceof DeepMissing).toBe(false);
    const restored = rehydrateFailure(decoded) as DeepMissing;
    expect(restored).toBe(decoded);
    expect(restored instanceof DeepMissing).toBe(true);
    expect(restored instanceof Missing).toBe(true);
    expect(restored.kind).toBe("missing");
    expect(restored.message).toBe("public message");
    expect(restored.describe()).toBe("public detail");
    expect(isSafeError(restored)).toBe(true);
    expect(failureClass("wire-test/DeepMissing")).toBe(DeepMissing);
    expect(registerFailure(DeepMissing, "wire-test/DeepMissing")).toBe(DeepMissing);
    expect(() => registerFailure(Sibling, "wire-test/Missing")).toThrow("already registered");
  });

  it("native author Errors use the same registry, including frozen throws", () => {
    class AuthorError extends Error {
      detail = "author prop";
    }
    class AuthorSub extends AuthorError {}
    registerFailure(AuthorError, "wire-test/AuthorError");
    registerFailure(AuthorSub, "wire-test/AuthorSub");
    const original = Object.freeze(new AuthorSub("native"));
    const prepared = prepareFailure(original);
    expect(prepared).not.toBe(original);
    expect(prepareFailure(Object.freeze(prepared))).toBeInstanceOf(AuthorSub);
    expect(isSafeError(prepared)).toBe(true);
    // Solid serializes enumerable props plus message even without toJSON.
    const wire = Object.assign(new Error(prepared.message), { ...prepared });
    const restored = rehydrateFailure(wire) as AuthorSub;
    expect(restored instanceof AuthorSub).toBe(true);
    expect(restored instanceof AuthorError).toBe(true);
    expect(restored.detail).toBe("author prop");
    expect(restored.message).toBe("native");
    const crash = new TypeError("unregistered");
    expect(prepareFailure(crash)).toBe(crash);
    expect(isSafeError(crash)).toBe(false);
  });

  it("unknown IDs stay unknown and ordinary crashes are untouched", () => {
    const value = decode(new Missing("original message"));
    Object.assign(value, { $yieldFailure: "absent/Class" });
    Object.freeze(value);
    const restored = rehydrateFailure(value) as Failure & { originalKind: string; detail: string };
    expect(restored instanceof Missing).toBe(false);
    expect(restored.kind).toBe("unknown");
    expect(restored.originalKind).toBe("missing");
    expect(restored.message).toBe("original message");
    expect(restored.detail).toBe("public detail");
    const crash = new TypeError("bug");
    expect(rehydrateFailure(crash)).toBe(crash);
  });

  it("restores a frozen decoded failure without mutating the frozen input", () => {
    const frozen = Object.freeze(decode(new Missing("frozen")));
    const restored = rehydrateFailure(frozen);
    expect(restored instanceof Missing).toBe(true);
    expect(restored).not.toBe(frozen);
  });

  it.each([false, true])("selective attempt covers subclasses (decoded: %s)", async decoded => {
    let seen: Missing | undefined;
    const event = $event(function* () {
      return yield* attempt(
        () => Promise.reject(decoded ? decode(new DeepMissing("sub")) : new DeepMissing("sub")),
        error => {
          seen = error;
          return "handled";
        },
        { catch: [Missing] }
      );
    });
    expect(await event()).toBe("handled");
    expect(seen instanceof DeepMissing).toBe(true);
  });

  it.each(["sync", "promise"])(
    "an unmatched nominal %s failure propagates as itself",
    async mode => {
      const sibling = new Sibling("direct sibling");
      let calls = 0;
      const event = $event(function* () {
        return yield* attempt(
          () => {
            if (mode === "sync") throw sibling;
            return Promise.reject(sibling);
          },
          () => {
            calls++;
          },
          { catch: [Missing] }
        );
      });
      await expect(event()).rejects.toBe(sibling);
      expect(calls).toBe(0);
    }
  );

  it("a selective stream passes an unmatched sibling through and handles a subclass", async () => {
    for (const covered of [false, true]) {
      const error = covered ? new DeepMissing("stream sub") : new Sibling("stream sibling");
      let calls = 0;
      const op = attempt(
        () => ({
          async *[Symbol.asyncIterator]() {
            yield "one";
            throw error;
          }
        }),
        () => {
          calls++;
        },
        { catch: [Missing] }
      );
      const result = op[Symbol.iterator]().next();
      expect(result.done).toBe(true);
      const stream = result.value as AsyncIterable<string>;
      const reader = stream[Symbol.asyncIterator]();
      expect(await reader.next()).toMatchObject({ value: "one", done: false });
      if (covered) expect(await reader.next()).toMatchObject({ done: true });
      else await expect(reader.next()).rejects.toBe(error);
      expect(calls).toBe(covered ? 1 : 0);
    }
  });

  it("selective attempt passes an event call's sibling to its caller", async () => {
    let calls = 0;
    const sibling = new Sibling("sibling");
    const child = $event(function* () {
      return yield* raise(sibling);
    });
    const event = $event(function* () {
      return yield* attempt(
        () => child(),
        () => {
          calls++;
        },
        { catch: [Missing] }
      );
    });
    await expect(event()).rejects.toBe(sibling);
    expect(calls).toBe(0);
  });

  it.each(["subclass", "sibling", "unknown"])(
    "a decoded %s reaches only its covering Errored",
    async which => {
      let inner: unknown, outer: unknown;
      const incoming = decode(
        which === "sibling" ? new Sibling("sibling") : new DeepMissing("sub")
      );
      if (which === "unknown") Object.assign(incoming, { $yieldFailure: "absent/Class" });
      const App = component(function* () {
        const data = yield* $memo(function* () {
          return yield* attempt(
            () => Promise.reject(incoming),
            e => e as Missing | Sibling
          );
        });
        return view(function* () {
          return (
            <>
              {
                yield* Errored({
                  fallback: error => {
                    outer = error();
                    return "outer";
                  },
                  children: function* () {
                    return (
                      <>
                        {
                          yield* Errored({
                            catch: [Missing],
                            fallback: error => {
                              inner = error();
                              return "inner";
                            },
                            children: function* () {
                              return (
                                <>
                                  {
                                    yield* Loading({
                                      fallback: "pending",
                                      children: function* () {
                                        return <i>{yield* data}</i>;
                                      }
                                    })
                                  }
                                </>
                              );
                            }
                          })
                        }
                      </>
                    );
                  }
                })
              }
            </>
          );
        });
      });
      const root = document.createElement("div");
      const dispose = render(App, root);
      await settle();
      expect(root.textContent).toBe(which === "subclass" ? "inner" : "outer");
      if (which === "subclass") expect(inner instanceof DeepMissing).toBe(true);
      else {
        expect(inner).toBeUndefined();
        if (which === "sibling") expect(outer instanceof Sibling).toBe(true);
        else expect((outer as Failure).kind).toBe("unknown");
      }
      dispose();
    }
  );
});
