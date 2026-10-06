import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const repo = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const rows = [];
for (const twin of readdirSync(join(repo, "examples"))
  .filter(x => /-yield(-h)?$/.test(x))
  .sort()) {
  for (const route of ["original", "library"]) {
    const name = twin.replace(/-yield(-h)?$/, "");
    const dir = join(repo, "examples", route === "original" ? `originals/${name}` : twin);
    const require = createRequire(join(dir, "package.json"));
    const { build } = await import(pathToFileURL(require.resolve("vite")));
    const root = name === "rendering" ? join(dir, "csr") : dir;
    let js = 0,
      gzip = 0,
      chunks = 0;
    await build({
      root,
      logLevel: "silent",
      ...(name === "rendering" ? { configFile: join(root, "vite.config.mjs") } : {}),
      build: { write: false, emptyOutDir: false },
      plugins: [
        {
          name: "executed-bytes:shipped",
          generateBundle(_options, bundle) {
            for (const output of Object.values(bundle))
              if (output.type === "chunk") {
                js += Buffer.byteLength(output.code);
                gzip += gzipSync(output.code).length;
                chunks++;
              }
          }
        }
      ]
    });
    if (!chunks || !js) throw new Error(`${twin}/${route}: no client chunks`);
    rows.push({ twin, route, js, gzip, chunks });
    console.error(`${twin}/${route}: ${js} JS bytes (${gzip} gzip), ${chunks} chunks`);
  }
}
writeFileSync(
  resolve(process.argv[2] ?? "documentation/shipped-bytes.json"),
  JSON.stringify(
    {
      metric:
        "production client JS chunks from Vite build(write:false); UTF-8 and sum of independently gzipped chunks; all routes",
      rows
    },
    null,
    2
  ) + "\n"
);
