import { $event, attempt, raise, Failure } from "solid-yield";
class Boom extends Failure("boom") {}
it("F10: attempt absorbs a frozen raised failure", async () => {
  const error = Object.freeze(new Boom("frozen"));
  const inner = $event(function* () {
    yield* raise(error);
  });
  const handled: unknown[] = [];
  const outer = $event(function* () {
    yield* attempt(
      () => inner(),
      e => {
        handled.push(e);
      }
    );
  });
  await expect(outer()).resolves.toBeUndefined();
  expect(handled).toEqual([error]);
  expect(JSON.parse(JSON.stringify(error))).toMatchObject({ kind: "boom", message: "frozen" });
});
