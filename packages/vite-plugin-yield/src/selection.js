import { resolve, relative, matchesGlob } from "node:path";
/** Serializable native selection, shared by Vite, tsserver and the CLI.
 * A JavaScript include predicate remains supported by the transform API.
 * @param {string} root @param {string[] | ((file:string)=>boolean)} include */
export function nativeInclude(root, include) {
  if (typeof include === "function") return include;
  if (!Array.isArray(include) || !include.length)
    throw new Error("[NATIVE_INCLUDE] Native mode requires explicit include patterns.");
  return /** @param {string} file */ file => {
    const name = relative(resolve(root), resolve(file)).replaceAll("\\", "/");
    return (
      !name.startsWith("../") &&
      !name.split("/").includes("node_modules") &&
      !name.split("/").includes(".generated") &&
      !/\.d\.[cm]?ts$/.test(name) &&
      include.some(p => matchesGlob(name, p))
    );
  };
}
