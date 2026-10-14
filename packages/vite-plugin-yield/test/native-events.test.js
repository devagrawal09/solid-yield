import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { SOLID_EVENTS } from "../src/native-events.js";
import { render } from "../../../scripts/native-events.mjs";

// A native handler's parameter is typed from a table read from Solid's JSX
// types at build time (scripts/native-events.mjs), through a cheap library
// type: asking TypeScript to resolve Solid's attribute interfaces for every
// handler made checking an app up to 80 % slower. The table must be what the
// installed Solid says, and the cheap type exactly Solid's handler parameter.
const file = resolve(import.meta.dirname, "fixtures/native-events-check.ts");
const tags = ["div", "input", "select", "textarea", "body", "video", "svg"];

describe("native event types (D-124)", { timeout: 120_000 }, () => {
  it("are the installed @solidjs/web's", () => {
    expect(readFileSync(resolve(import.meta.dirname, "../src/native-events.js"), "utf8")).toBe(
      render()
    );
  });

  it("type each handler's event exactly as Solid's JSX does", () => {
    const typed = Object.entries(SOLID_EVENTS).filter(([, [event]]) => event);
    expect(typed.length).toBeGreaterThan(130);
    const code = `import type { JSX } from "@solidjs/web";
import type { NativeHandlerEvent } from "solid-yield/internal";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Attrs<Tag extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[Tag];
type Param<Tag extends keyof JSX.IntrinsicElements, A extends keyof Attrs<Tag>> = Parameters<
  Extract<NonNullable<Attrs<Tag>[A]>, (event: never) => unknown>
>[0];
type Check<Tag extends keyof JSX.IntrinsicElements, A extends string, E extends Event, K extends "plain" | "input" | "change" | "focus"> =
  A extends keyof Attrs<Tag> ? Equal<Param<Tag, A>, NativeHandlerEvent<E, Tag, K>> : true;
type Present<A extends string> = ${tags.map(tag => `A extends keyof Attrs<"${tag}"> ? true : `).join("")}false;
${typed
  .map(
    ([name, [event, kind]]) =>
      `export const ${name}: [Present<"${name}">, ${tags
        .map(tag => `Check<"${tag}", "${name}", ${event}, "${kind}">`)
        .join(", ")}] = [true, ${tags.map(() => "true").join(", ")}];`
  )
  .join("\n")}
`;
    const options = {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      types: [],
      lib: ["lib.esnext.d.ts", "lib.dom.d.ts"]
    };
    const host = ts.createCompilerHost(options),
      read = host.readFile,
      exists = host.fileExists;
    host.readFile = path => (path === file ? code : read(path));
    host.fileExists = path => path === file || exists(path);
    const errors = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host)).map(d => {
      const line = d.file ? ts.getLineAndCharacterOfPosition(d.file, d.start ?? 0).line : -1;
      return `${code.split("\n")[line]?.slice(13, 40)}: ${ts.flattenDiagnosticMessageText(d.messageText, " ").slice(0, 200)}`;
    });
    expect(errors).toEqual([]);
  });
});
