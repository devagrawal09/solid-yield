import { Failure } from "solid-yield";
class Boom extends Failure("boom") {}
it("Failure creates a nominal Error instance with a serializable kind", () => {
  const error = new Boom("failed", { cause: "source" });
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(Boom);
  expect(error.kind).toBe("boom");
  expect(JSON.parse(JSON.stringify(error))).toEqual({
    $yieldFailure: "",
    name: "Error",
    message: "failed",
    kind: "boom",
    cause: "source"
  });
});
