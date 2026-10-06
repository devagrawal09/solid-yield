import { Failure, raise, attempt, Errored } from "solid-yield";
class Boom extends Failure("boom") {}
const shape = { name: "Error", message: "shaped", kind: "boom" as const };
// F09: the same kind does not make a structural object an instanceof Boom.
// @ts-expect-error a shaped object lacks the nominal instance brand
const e: Boom = shape;
// @ts-expect-error [FAILURE_CLASS] use Failure(...)
raise(shape);
// @ts-expect-error freezing a shape does not make it a nominal instance
raise(Object.freeze(shape));
raise(Object.freeze(new Boom()));
class Structural extends Error {
  readonly kind = "structural" as const;
}
// @ts-expect-error even an Error subclass needs the nominal base
raise(new Structural());
attempt(
  () => BigInt("invalid"),
  // @ts-expect-error attempt cannot brand structural failures into a typed union
  () => new Structural()
);
// @ts-expect-error catch cannot subtract a structural class
Errored({ catch: [Structural], fallback: "caught", children: "ok" });
raise(new Boom());
attempt(
  () => BigInt("invalid"),
  () => new Boom()
);
Errored({ catch: [Boom], fallback: "caught", children: "ok" });
void e;
