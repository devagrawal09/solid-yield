import { extractModule } from "./emit.js";

/** First C3 emission unit. The server function returns the extracted template;
 * the authored setup, memo, error boundary and pure derivation run inside it.
 * It is deliberately not wired into the client until frame edge checks pass.
 */
export function emitServerRegion(code, filename, name, inputs) {
  if (!/^[A-Za-z_$][\w$]*$/.test(name) || inputs.some(n => !/^[A-Za-z_$][\w$]*$/.test(n)))
    throw new Error("Region and input names must be identifiers");
  // Append generated declarations so retained authored lines keep their offsets.
  return extractModule(
    code +
      `
import {foreign as __regionForeign} from "solid-yield";
export async function __serverRegion(${inputs.join(",")}) {
  "use server";
  return () => __regionForeign(${name})({${inputs.join(",")}});
}
`,
    filename,
    ["__serverRegion"]
  );
}
