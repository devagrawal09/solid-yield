import { attempt, until } from "solid-yield";
class Boom extends Error {
  readonly kind = "boom" as const;
}
const handle = (): unknown => new Boom("hidden");
// F02: unknown could hide an Error, erasing its failure color.
// @ts-expect-error [ATTEMPT_RETURN] declare the handler's return type
attempt(() => BigInt("invalid"), handle);
attempt(
  () => BigInt("invalid"),
  // @ts-expect-error the generator's return cannot hide a failure either
  function* (): Generator<never, unknown, unknown> {
    return new Boom();
  }
);
// @ts-expect-error until uses the same handler check
until(() => true, handle);
attempt(
  () => 1,
  () => {}
);
attempt(
  () => 1,
  () => "fallback"
);
attempt(
  () => 1,
  () => new Boom()
);
