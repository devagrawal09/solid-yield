/** C0 §1.6: serialization succeeding is necessary, not sufficient. In particular
 * the default web codec preserves Error.kind but not custom Error prototypes.
 * The caller supplies the public web codec so this module needs no second copy.
 */
export function capture(value, { serializeJSON, createJSONDeserializer }, at) {
  let node,
    failure,
    count = 0;
  const close = serializeJSON(value, {
    onParse(next) {
      node = next;
      count++;
    },
    onError(error) {
      failure = error;
    }
  });
  close();
  if (failure || count !== 1)
    return {
      ok: false,
      at,
      reason: failure
        ? "public serializer refused the capture"
        : "capture is not synchronously settled"
    };
  let decoded;
  try {
    decoded = createJSONDeserializer()(node);
  } catch {
    return { ok: false, at, reason: "public deserializer refused the capture" };
  }
  const seen = new WeakSet();
  const check = (a, b) => {
    if (a === null || typeof a !== "object" || seen.has(a)) return true;
    seen.add(a);
    if (typeof a.then === "function") return false;
    if (a instanceof Error && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
    if (a instanceof Map) {
      const entries = [...b];
      return [...a].every(
        ([key, val], i) => check(key, entries[i][0]) && check(val, entries[i][1])
      );
    }
    if (a instanceof Set) return [...a].every((item, i) => check(item, [...b][i]));
    return Object.keys(a).every(key => check(a[key], b?.[key]));
  };
  if (!check(value, decoded))
    return {
      ok: false,
      at,
      reason: "serializer lost the failure class; retaining kind alone changes Errored.catch"
    };
  return { ok: true, node, value: decoded };
}
