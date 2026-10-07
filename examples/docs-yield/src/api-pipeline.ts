"use pure";
import { jsonSchemaToZod } from "json-schema-to-zod";
import core from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import { escapeHtml as esc, formatDate } from "./pipeline-utils";
import type { Article } from "./api";

// This renderer consumes a JSON Schema catalog, resolves local references,
// generates usable validation examples, and walks nested schemas into tables.
// No generated code is evaluated. References remain links in the HTML and
// expand only for code generation, with cycles explicitly rejected.
type Schema =
  | boolean
  | {
      $ref?: string;
      title?: string;
      description?: string;
      type?: string | string[];
      properties?: Record<string, Schema>;
      required?: string[];
      items?: Schema;
      enum?: unknown[];
      const?: unknown;
      default?: unknown;
      examples?: unknown[];
      anyOf?: Schema[];
      oneOf?: Schema[];
      allOf?: Schema[];
      additionalProperties?: Schema;
      minimum?: number;
      maximum?: number;
      minLength?: number;
      maxLength?: number;
      minItems?: number;
      maxItems?: number;
      pattern?: string;
      format?: string;
      deprecated?: boolean;
      readOnly?: boolean;
      writeOnly?: boolean;
    };
type Catalog = { $defs: Record<string, Schema> };
export function renderApi(article: Article) {
  const catalog: Catalog = JSON.parse(article.markdown);
  const names = Object.keys(catalog.$defs);
  const ids = new Map(names.map(name => [name, "api-" + name.toLowerCase()]));
  const highlighter = core.newInstance();
  highlighter.registerLanguage("typescript", typescript);
  const lookup = (ref: string): [string, Schema] => {
    const prefix = "#/$defs/";
    if (!ref.startsWith(prefix))
      throw new Error("Only catalog-local references are supported: " + ref);
    const name = ref.slice(prefix.length).replaceAll("~1", "/").replaceAll("~0", "~");
    if (!Object.hasOwn(catalog.$defs, name)) throw new Error("Unknown API entry: " + name);
    return [name, catalog.$defs[name]];
  };
  const expand = (schema: Schema, seen: string[] = []): Schema => {
    if (typeof schema === "boolean") return schema;
    if (schema.$ref) {
      const [name, target] = lookup(schema.$ref);
      if (seen.includes(name))
        throw new Error("Recursive example schema: " + [...seen, name].join(" -> "));
      return expand(target, [...seen, name]);
    }
    return {
      ...schema,
      ...(schema.properties
        ? {
            properties: Object.fromEntries(
              Object.entries(schema.properties).map(([k, v]) => [k, expand(v, seen)])
            )
          }
        : {}),
      ...(schema.items !== undefined ? { items: expand(schema.items, seen) } : {}),
      ...(schema.additionalProperties !== undefined
        ? { additionalProperties: expand(schema.additionalProperties, seen) }
        : {}),
      ...(schema.anyOf ? { anyOf: schema.anyOf.map(s => expand(s, seen)) } : {}),
      ...(schema.oneOf ? { oneOf: schema.oneOf.map(s => expand(s, seen)) } : {}),
      ...(schema.allOf ? { allOf: schema.allOf.map(s => expand(s, seen)) } : {})
    };
  };
  const typeLabel = (schema: Schema): string => {
    if (typeof schema === "boolean") return schema ? "unknown" : "never";
    if (schema.$ref) {
      const [name] = lookup(schema.$ref);
      return `<a class="api-entry-link" href="#${ids.get(name)}">${esc(name)}</a>`;
    }
    if (schema.const !== undefined) return esc(JSON.stringify(schema.const));
    if (schema.enum) return schema.enum.map(v => esc(JSON.stringify(v))).join(" | ");
    const variants = schema.anyOf ?? schema.oneOf ?? schema.allOf;
    if (variants) return variants.map(typeLabel).join(schema.allOf ? " &amp; " : " | ");
    if (schema.type === "array") return `Array&lt;${typeLabel(schema.items ?? true)}&gt;`;
    return esc(Array.isArray(schema.type) ? schema.type.join(" | ") : (schema.type ?? "unknown"));
  };
  const constraints = (schema: Schema): string => {
    if (typeof schema === "boolean") return "";
    const values: string[] = [];
    for (const key of [
      "minimum",
      "maximum",
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
      "pattern",
      "format",
      "default"
    ] as const)
      if (schema[key] !== undefined) values.push(`${key}: ${JSON.stringify(schema[key])}`);
    for (const key of ["deprecated", "readOnly", "writeOnly"] as const)
      if (schema[key]) values.push(key);
    return values.map(esc).join("; ");
  };
  const rows = (schema: Schema, path = "", depth = 0): string => {
    if (typeof schema === "boolean" || !schema.properties) return "";
    if (depth > 12) throw new Error("API table nesting exceeds supported depth");
    return Object.entries(schema.properties)
      .map(([key, child]) => {
        const field = path ? path + "." + key : key;
        const description = typeof child === "boolean" ? "" : (child.description ?? "");
        return (
          `<tr><th scope="row"><code>${esc(field)}</code></th><td>${typeLabel(child)}</td><td>${schema.required?.includes(key) ? "required" : "optional"}</td><td>${esc(description)}</td><td>${constraints(child)}</td></tr>` +
          rows(child, field, depth + 1)
        );
      })
      .join("");
  };
  const toc = names.map(name => ({ id: ids.get(name)!, title: name, depth: 2 }));
  const sections = names
    .map(name => {
      const schema = catalog.$defs[name];
      const resolved = expand(schema, [name]);
      // The real generator handles unions, constraints, defaults, object/array
      // structure and Zod syntax. Its output is useful copyable API documentation.
      const code = jsonSchemaToZod(resolved as Parameters<typeof jsonSchemaToZod>[0], {
        name: name + "Schema",
        module: "esm"
      });
      const example = highlighter.highlight(code, {
        language: "typescript",
        ignoreIllegals: true
      }).value;
      const description = typeof schema === "boolean" ? "" : (schema.description ?? "");
      return `<section class="api-entry" id="${ids.get(name)}"><h2>${esc(name)}</h2><p>${esc(description)}</p><p>Type: ${typeLabel(schema)}</p><table><caption>${esc(name)} fields</caption><thead><tr><th>Field</th><th>Type</th><th>Presence</th><th>Description</th><th>Constraints</th></tr></thead><tbody>${rows(schema)}</tbody></table><h3>Validation example</h3><pre><code class="hljs language-ts">${example}</code></pre></section>`;
    })
    .join("");
  return {
    html: `<div class="api-reference">${sections}</div>`,
    toc,
    date: formatDate(article.published)
  };
}
