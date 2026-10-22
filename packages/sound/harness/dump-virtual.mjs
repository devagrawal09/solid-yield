// @ts-check
// Debug aid for prototype A: prints the virtual program text for a fixture file
// and the raw TypeScript diagnostics the classifier sees.
//   node harness/dump-virtual.mjs fixtures/mutants/m-effect-phase-pending.tsx
import ts from "typescript";
import { resolve } from "node:path";
import { Transformer } from "../prototypes/typed/transform.mjs";
import { compilerOptions } from "./compiler-options.mjs";
import { packageDir } from "./load.mjs";

const file = resolve(process.argv[2] ?? "");
const program = ts.createProgram([file], compilerOptions);
const t = new Transformer(program, [file]);
const sf = program.getSourceFile(file);
if (!sf) throw new Error("no source file");
const out = t.transformFile(sf);
console.log(out.text());
console.log("---- transform diagnostics");
for (const d of t.diagnostics) console.log(d.severity, d.loc.line + ":" + d.loc.col, d.code, d.message.slice(0, 120));
const runtime = resolve(packageDir, "prototypes/typed/runtime.d.ts");
const vfile = file.replace(/\.tsx?$/, ".virtual.tsx");
const host = ts.createCompilerHost({ ...compilerOptions, paths: { "solid-sound-typed": [runtime] } });
const readFile = host.readFile;
host.readFile = f => (f === vfile ? out.text() : readFile(f));
host.fileExists = f => f === vfile || ts.sys.fileExists(f);
void packageDir;
const vp = ts.createProgram([vfile], { ...compilerOptions, paths: { "solid-sound-typed": [runtime] } }, host);
console.log("---- ts diagnostics");
for (const d of ts.getPreEmitDiagnostics(vp)) {
  const pos = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
  console.log(pos ? `${pos.line + 1}:${pos.character + 1}` : "?", ts.flattenDiagnosticMessageText(d.messageText, " ").slice(0, 300));
}
