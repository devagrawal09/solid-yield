#!/usr/bin/env node
// The app corpus (documentation/corpus/README.md): open-source Solid 1 apps at pinned commits,
// and what each would have to change for Solid 2. Report only: nothing here is a gate step.
//
//   node scripts/corpus.mjs fetch [--dir D]                 clone each app at its pin
//   node scripts/corpus.mjs pin   [--dir D]                 move each pin to the default branch
//   node scripts/corpus.mjs scan  [--dir D] [--npm] [--write]
//
// D defaults to $SOLID_YIELD_CORPUS, else ../solid-yield-corpus; an app lives at D/<owner>/<repo>.
// --npm asks the registry which Solid dependencies have a release that declares solid-js 2.
// --write saves documentation/corpus/report.{json,md}; without it the report goes to stdout.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "documentation/corpus");
const manifestPath = join(docs, "apps.json");

const args = process.argv.slice(2);
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dir = resolve(
  option("--dir") ?? process.env.SOLID_YIELD_CORPUS ?? join(root, "../solid-yield-corpus")
);

function git(cwd, ...gitArgs) {
  const result = spawnSync("git", gitArgs, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" }
  });
  return { ok: result.status === 0, out: result.stdout.trim(), err: result.stderr.trim() };
}

// Shallow fetch of one commit (or the default branch) into D/<owner>/<repo>.
function checkout(app, ref) {
  const dest = join(dir, app.repo);
  if (!existsSync(join(dest, ".git"))) {
    mkdirSync(dest, { recursive: true });
    git(dest, "init", "-q");
    git(dest, "remote", "add", "origin", `https://github.com/${app.repo}`);
  }
  if (ref !== "HEAD" && git(dest, "rev-parse", "HEAD").out === ref) return { status: "pinned" };
  const fetched = git(dest, "fetch", "-q", "--depth", "1", "origin", ref);
  if (!fetched.ok) return { status: `FAILED ${fetched.err.split("\n")[0]}` };
  const done = git(dest, "checkout", "-q", "--detach", "FETCH_HEAD");
  if (!done.ok) return { status: `FAILED ${done.err.split("\n")[0]}` };
  return { status: "fetched", head: git(dest, "rev-parse", "HEAD").out };
}

// Solid 1 → 2 changes, from solid-js@2.0.0-rc.13's CHEATSHEET.md ("What changed from 1.x").
// `call` / `tag` count only names imported from solid-js (any entry point), under their local
// alias; `pattern` counts raw matches (`jsx`: only in .jsx/.tsx files).
const CHANGES = [
  { id: "solid-js/web", group: "moved", to: "@solidjs/web", module: /^solid-js\/web$/ },
  { id: "solid-js/store", group: "moved", to: "solid-js", module: /^solid-js\/store$/ },
  {
    id: "solid-js/h|html|universal",
    group: "moved",
    to: "@solidjs/…",
    module: /^solid-js\/(h|html|universal)$/
  },
  { id: "Suspense", group: "renamed", to: "Loading", tag: "Suspense" },
  { id: "SuspenseList", group: "renamed", to: "Reveal", tag: "SuspenseList" },
  { id: "ErrorBoundary", group: "renamed", to: "Errored", tag: "ErrorBoundary" },
  { id: "mergeProps", group: "renamed", to: "merge", call: "mergeProps" },
  { id: "splitProps", group: "renamed", to: "omit", call: "splitProps" },
  { id: "unwrap", group: "renamed", to: "snapshot", call: "unwrap" },
  { id: "onMount", group: "renamed", to: "onSettled", call: "onMount" },
  { id: "createSelector", group: "renamed", to: "createProjection", call: "createSelector" },
  { id: "equalFn", group: "renamed", to: "isEqual", call: "equalFn" },
  { id: "getListener", group: "renamed", to: "getObserver", call: "getListener" },
  {
    id: "Context.Provider",
    group: "renamed",
    to: "<Context value>",
    pattern: /<[\w$.]+\.Provider\b/g,
    jsx: true
  },
  { id: "classList", group: "renamed", to: "class={{…}}", pattern: /\bclassList\s*=/g, jsx: true },
  { id: "batch", group: "removed", to: "microtask batching; flush()", call: "batch" },
  {
    id: "createComputed",
    group: "removed",
    to: "createMemo / split createEffect",
    call: "createComputed"
  },
  {
    id: "createResource",
    group: "removed",
    to: "async computations + <Loading>",
    call: "createResource"
  },
  { id: "startTransition", group: "removed", to: "built-in transitions", call: "startTransition" },
  { id: "useTransition", group: "removed", to: "isPending / <Loading>", call: "useTransition" },
  { id: "on", group: "removed", to: "split effects", call: "on" },
  { id: "onError", group: "removed", to: "<Errored> / effect error", call: "onError" },
  { id: "catchError", group: "removed", to: "<Errored> / effect error", call: "catchError" },
  { id: "produce", group: "removed", to: "draft-first setters", call: "produce" },
  { id: "createMutable", group: "removed", to: "createStore + drafts", call: "createMutable" },
  { id: "modifyMutable", group: "removed", to: "createStore + drafts", call: "modifyMutable" },
  { id: "from", group: "removed", to: "async iterables", call: "from" },
  { id: "observable", group: "removed", to: "createEffect", call: "observable" },
  { id: "Index", group: "removed", to: "<For keyed={false}>", tag: "Index" },
  { id: "indexArray", group: "removed", to: "mapArray", call: "indexArray" },
  {
    id: "resetErrorBoundaries",
    group: "removed",
    to: "boundaries heal",
    call: "resetErrorBoundaries"
  },
  {
    id: "use: directives",
    group: "removed",
    to: "ref={fn(x)}",
    pattern: /\suse:[\w$]/g,
    jsx: true
  },
  {
    id: "attr:/bool:/on:/oncapture:",
    group: "removed",
    to: "plain attributes / onX",
    pattern: /\s(?:attr|bool|on|oncapture):[\w$]/g,
    jsx: true
  },
  {
    id: "createEffect",
    group: "behavior",
    to: "two arguments: (compute, apply)",
    call: "createEffect"
  },
  {
    id: "destructured props",
    group: "behavior",
    to: "props.x (heuristic count)",
    pattern:
      /\b(?:function\s+[A-Z][\w$]*\s*\(\s*\{|const\s+[A-Z][\w$]*\s*(?::[^=\n]+)?=\s*\(\s*\{)/g,
    jsx: true
  }
];

// Names Solid 2 keeps, counted for the compiler's coverage; and the router/Start data APIs,
// whose Solid 2 shape is @solidjs/router 2's to say, not this list's.
const KEPT = [
  "createSignal",
  "createMemo",
  "createStore",
  "createContext",
  "useContext",
  "createRoot",
  "untrack",
  "onCleanup",
  "lazy",
  "children",
  "mapArray"
]
  .map(call => ({ id: call, call }))
  .concat(["For", "Show", "Switch", "Match", "Dynamic", "Portal"].map(tag => ({ id: tag, tag })));
const ROUTER = [
  "createAsync",
  "createAsyncStore",
  "query",
  "cache",
  "action",
  "useAction",
  "useSubmission",
  "useSubmissions",
  "revalidate"
]
  .map(call => ({ id: call, call, from: /^@solidjs\/router$/ }))
  .concat([{ id: '"use server"', pattern: /["']use server["']/g }]);

const SOLID_MODULE = /^solid-js(\/[\w-]+)?$/;
const IMPORT = /import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const MODULES = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".output",
  ".vinxi",
  ".solid",
  ".astro",
  ".next",
  "out",
  "coverage",
  "target",
  ".turbo",
  "public",
  "vendor"
]);
const SOURCE = new Set([".ts", ".tsx", ".js", ".jsx"]);

function* walk(path, skipped) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !skipped.has(child)) yield* walk(child, skipped);
    } else if (entry.isFile()) yield child;
  }
}

const escape = name => name.replace(/\$/g, "\\$");
const GENERIC = "(?:<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)";

function count(rules, source, jsx, imports) {
  // `=>` inside type arguments would close a bracket early.
  const text = source.replace(/=>/g, "=:");
  const counts = {};
  for (const rule of rules) {
    let n = 0;
    if (rule.module) n = [...imports.keys()].some(m => rule.module.test(m)) ? 1 : 0;
    else if (rule.pattern) n = rule.jsx && !jsx ? 0 : (text.match(rule.pattern) ?? []).length;
    else {
      const from = rule.from ?? SOLID_MODULE;
      for (const [module, names] of imports) {
        const local = from.test(module) && names.get(rule.call ?? rule.tag);
        if (!local) continue;
        // A call may pass type arguments: createSignal<Item[]>(…), up to three levels deep.
        const use = rule.call
          ? `\\b${escape(local)}\\s*${GENERIC}?\\s*\\(`
          : `<${escape(local)}\\b`;
        n += (text.match(new RegExp(use, "g")) ?? []).length;
      }
    }
    if (n) counts[rule.id] = n;
  }
  return counts;
}

function add(total, counts) {
  for (const [id, n] of Object.entries(counts)) total[id] = (total[id] ?? 0) + n;
}

function importsOf(text) {
  const imports = new Map();
  for (const [, specifiers, module] of text.matchAll(IMPORT)) {
    const names = imports.get(module) ?? new Map();
    for (const spec of specifiers.split(",")) {
      const [imported, local] = spec
        .replace(/^\s*type\s+/, "")
        .trim()
        .split(/\s+as\s+/);
      if (imported) names.set(imported, local ?? imported);
    }
    imports.set(module, names);
  }
  for (const [, module] of text.matchAll(MODULES))
    if (!imports.has(module)) imports.set(module, new Map());
  return imports;
}

function license(base) {
  const file = readdirSync(base).find(name => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(name));
  const text = file ? readFileSync(join(base, file), "utf8").slice(0, 2000) : "";
  const known = [
    [/GNU AFFERO GENERAL PUBLIC LICENSE/i, "AGPL-3.0"],
    [/GNU GENERAL PUBLIC LICENSE/i, "GPL"],
    [/Apache License/i, "Apache-2.0"],
    [/Mozilla Public License/i, "MPL-2.0"],
    [/Functional Source License/i, "FSL"],
    [/Permission is hereby granted, free of charge/i, "MIT"],
    [/Permission to use, copy, modify, and\/or distribute/i, "ISC"],
    [/Redistribution and use in source and binary forms/i, "BSD"]
  ];
  const found = known.find(([test]) => test.test(text));
  if (found) return found[1];
  const pkg = existsSync(join(base, "package.json")) ? readJson(join(base, "package.json")) : {};
  return typeof pkg.license === "string" ? pkg.license : file ? "other" : "none";
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

// `catalog:` / `catalog:<name>` ranges, from pnpm-workspace.yaml or a bun/npm workspaces catalog.
function catalogRange(base, range, name) {
  const yaml = join(base, "pnpm-workspace.yaml");
  if (existsSync(yaml)) {
    const line = readFileSync(yaml, "utf8").match(
      new RegExp(`^\\s+['"]?${name}['"]?:\\s*['"]?([^'"\\s]+)`, "m")
    );
    if (line) return line[1];
  }
  const workspaces = readJson(join(base, "package.json")).workspaces ?? {};
  const catalog = range === "catalog:" ? workspaces.catalog : workspaces.catalogs?.[range.slice(8)];
  return catalog?.[name] ?? range;
}

const SOLID_DEP = /solid(?!ity)|^@(kobalte|corvu)\//i;
const STACK = [
  ["@solidjs/start", "SolidStart"],
  ["@solidjs/router", "Router"],
  ["@tauri-apps/api", "Tauri"],
  ["electron", "Electron"],
  ["@tanstack/solid-query", "TanStack Query"],
  ["@kobalte/core", "Kobalte"]
];

function scanApp(app) {
  const base = join(dir, app.repo);
  if (!existsSync(join(base, ".git"))) return { repo: app.repo, missing: true };
  const skipped = new Set(Object.keys(app.outOfScope ?? {}).map(path => join(base, path)));
  const files = new Set();
  for (const path of app.paths) {
    if (!existsSync(join(base, path)))
      console.error(`${app.repo}: no ${path} at ${app.sha.slice(0, 7)}`);
    else for (const file of walk(join(base, path), skipped)) files.add(file);
  }

  const result = {
    repo: app.repo,
    kind: app.kind,
    sha: git(base, "rev-parse", "HEAD").out,
    lastCommit: git(base, "log", "-1", "--format=%cs").out,
    license: license(base),
    solid: new Set(),
    stack: new Set(),
    deps: new Set(),
    files: { source: 0, solid: 0, solidLines: 0 },
    tests: { e2e: false, unit: 0 },
    changes: {},
    kept: {},
    router: {}
  };
  const workspaceNames = new Set();
  const packages = [...files].filter(file => file.endsWith("/package.json"));
  for (const file of packages) workspaceNames.add(readJson(file).name);
  for (const file of packages) {
    const pkg = readJson(file);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    if (deps["solid-js"]) {
      const range = deps["solid-js"];
      result.solid.add(
        range.startsWith("catalog:") ? catalogRange(base, range, "solid-js") : range
      );
    }
    for (const [dep, label] of STACK) if (deps[dep]) result.stack.add(label);
    for (const [dep, range] of Object.entries(deps)) {
      if (dep === "solid-js" || workspaceNames.has(dep) || String(range).startsWith("workspace:"))
        continue;
      if (SOLID_DEP.test(dep)) result.deps.add(dep);
    }
  }
  for (const file of files) {
    const name = file.slice(file.lastIndexOf("/") + 1);
    if (/^(playwright|cypress)\.config\.|^cypress\.json$/.test(name)) result.tests.e2e = true;
    const ext = extname(file);
    if (!SOURCE.has(ext) || file.endsWith(".d.ts")) continue;
    result.files.source++;
    if (/\.(test|spec)\.[jt]sx?$/.test(name)) result.tests.unit++;
    // Tests and stories migrate too, but the counts below are about the app's own code.
    if (/\.(test|spec|stories)\.[jt]sx?$/.test(name) || /\/(tests?|e2e|__tests__)\//.test(file))
      continue;
    const text = readFileSync(file, "utf8");
    const imports = importsOf(text);
    const solidImport = [...imports.keys()].some(
      m => SOLID_MODULE.test(m) || m.startsWith("@solidjs/")
    );
    // Older apps write JSX in .js files under babel-preset-solid.
    const jsx = ext === ".tsx" || ext === ".jsx" || (ext === ".js" && solidImport);
    if (!jsx && !solidImport) continue;
    result.files.solid++;
    result.files.solidLines += text.split("\n").length;
    add(result.changes, count(CHANGES, text, jsx, imports));
    add(result.kept, count(KEPT, text, jsx, imports));
    add(result.router, count(ROUTER, text, jsx, imports));
  }
  for (const key of ["solid", "stack", "deps"]) result[key] = [...result[key]].sort();
  return result;
}

// A release "declares Solid 2" when its solid-js peer (or dependency) range names major 2.
function namesSolid2(range) {
  return String(range)
    .split("||")
    .some(part =>
      part
        .trim()
        .split(/\s+/)
        .some(c => /^(\^|~|>=|>|=)?\s*v?2(\.|$)/.test(c))
    );
}

async function npmReadiness(names) {
  const readiness = {};
  const queue = [...names];
  async function worker() {
    for (let name = queue.shift(); name; name = queue.shift()) {
      try {
        const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, {
          headers: { accept: "application/vnd.npm.install-v1+json" }
        });
        if (!response.ok) {
          readiness[name] = { npm: false };
          continue;
        }
        const meta = await response.json();
        const solid2 = Object.entries(meta.versions ?? {})
          .map(([version, v]) => [
            version,
            v.peerDependencies?.["solid-js"] ?? v.dependencies?.["solid-js"]
          ])
          .filter(([, range]) => range && namesSolid2(range));
        const latest = solid2.at(-1);
        readiness[name] = {
          npm: true,
          solid2: latest ? { version: latest[0], solid: latest[1] } : null
        };
      } catch (error) {
        readiness[name] = { npm: null, error: error.cause?.code ?? error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return readiness;
}

const sum = counts => Object.values(counts).reduce((a, b) => a + b, 0);
const byGroup = (counts, group) =>
  sum(
    Object.fromEntries(CHANGES.filter(c => c.group === group).map(c => [c.id, counts[c.id] ?? 0]))
  );
const cell = text => String(text).replace(/\|/g, "\\|");

function markdown(report) {
  const apps = report.apps
    .filter(app => !app.missing)
    .sort((a, b) => b.files.solidLines - a.files.solidLines);
  const lines = [
    "# Corpus report",
    "",
    `Generated by \`node scripts/corpus.mjs scan${report.npm ? " --npm" : ""} --write\` on ${report.date}. ` +
      "Apps and pins: [apps.json](apps.json); method and limits: [README.md](README.md). " +
      'Solid 1 → 2 changes are the list in solid-js 2.0.0-rc.13\'s `CHEATSHEET.md` ("What changed from 1.x").',
    "",
    "## Apps",
    "",
    "Sorted by lines in Solid files. A Solid file is a .jsx/.tsx file, or a .js/.ts file that imports solid-js or @solidjs/*, inside the app's `paths`; test, spec and story files are not counted here or below (Unit tests counts .test/.spec files).",
    "",
    "| App | Kind | Last commit | License | solid-js | Stack | Solid files | Lines | Unit tests | E2E | Solid deps" +
      (report.npm ? " (with a Solid 2 release)" : "") +
      " |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: |"
  ];
  for (const app of apps) {
    const ready = report.npm ? ` (${app.deps.filter(d => report.npm[d]?.solid2).length})` : "";
    lines.push(
      `| [${app.repo}](https://github.com/${app.repo}/tree/${app.sha}) | ${cell(app.kind)} | ${app.lastCommit} | ${app.license} | ` +
        `${cell(app.solid.join(", "))} | ${app.stack.join(", ") || "Vite"} | ${app.files.solid} | ${app.files.solidLines} | ` +
        `${app.tests.unit} | ${app.tests.e2e ? "yes" : "no"} | ${app.deps.length}${ready} |`
    );
  }
  lines.push(
    "",
    "## Migration surface per app",
    "",
    "Uses of Solid 1 APIs that Solid 2 moves, renames or removes, and of `createEffect` (whose one-argument form is gone) and destructured component props (a heuristic). Moved imports count files.",
    "",
    "| App | Moved imports | Renamed | Removed | createEffect | Destructured props | Total | Top removed |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
  );
  for (const app of apps) {
    const removed = CHANGES.filter(c => c.group === "removed" && app.changes[c.id])
      .sort((a, b) => app.changes[b.id] - app.changes[a.id])
      .slice(0, 3)
      .map(c => `${c.id} ${app.changes[c.id]}`);
    lines.push(
      `| ${app.repo} | ${byGroup(app.changes, "moved")} | ${byGroup(app.changes, "renamed")} | ${byGroup(app.changes, "removed")} | ` +
        `${app.changes.createEffect ?? 0} | ${app.changes["destructured props"] ?? 0} | ${sum(app.changes)} | ${cell(removed.join(", "))} |`
    );
  }
  const totals = (rules, key) =>
    rules
      .map(rule => ({
        rule,
        uses: apps.reduce((n, app) => n + (app[key][rule.id] ?? 0), 0),
        apps: apps.filter(app => app[key][rule.id]).length
      }))
      .filter(row => row.uses)
      .sort((a, b) => b.apps - a.apps || b.uses - a.uses);
  lines.push(
    "",
    "## Changes across the corpus",
    "",
    "| Solid 1 | Kind | Solid 2 | Uses | Apps |",
    "| --- | --- | --- | ---: | ---: |"
  );
  for (const { rule, uses, apps: n } of totals(CHANGES, "changes"))
    lines.push(`| \`${cell(rule.id)}\` | ${rule.group} | ${cell(rule.to)} | ${uses} | ${n} |`);
  lines.push(
    "",
    "## Kept APIs and router/Start data APIs",
    "",
    "Kept names still need the compiler's coverage. Router and SolidStart data APIs change with @solidjs/router 2 and SolidStart 2; check those packages, not this table, for their new shape.",
    "",
    "| API | Uses | Apps |",
    "| --- | ---: | ---: |"
  );
  for (const { rule, uses, apps: n } of [...totals(KEPT, "kept"), ...totals(ROUTER, "router")])
    lines.push(`| \`${cell(rule.id)}\` | ${uses} | ${n} |`);
  const deps = new Map();
  for (const app of apps) for (const dep of app.deps) deps.set(dep, (deps.get(dep) ?? 0) + 1);
  const rows = [...deps].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  lines.push(
    "",
    "## Third-party Solid dependencies",
    "",
    "Dependencies whose name mentions solid, plus @kobalte/* and @corvu/*; workspace packages excluded." +
      (report.npm
        ? ' "Solid 2 release" is the most recently published version on npm whose solid-js peer (or dependency) range names major 2, with that range: an rc pin older than the one this repo uses is not proof it works on it.'
        : " Run with --npm for Solid 2 readiness."),
    "",
    `| Package | Apps |${report.npm ? " Solid 2 release |" : ""}`,
    `| --- | ---: |${report.npm ? " --- |" : ""}`
  );
  for (const [dep, n] of rows) {
    if (n < 2 && rows.length > 40) continue;
    const npm = report.npm?.[dep];
    const ready = !report.npm
      ? ""
      : npm?.solid2
        ? ` ${npm.solid2.version} (solid-js ${cell(npm.solid2.solid)}) |`
        : npm?.npm === false
          ? " not on npm |"
          : npm?.npm === null
            ? ` unknown (${npm.error}) |`
            : " none |";
    lines.push(`| ${dep} | ${n} |${ready}`);
  }
  if (rows.length > 40)
    lines.push(
      "",
      `Packages used by one app only are in report.json (${rows.filter(([, n]) => n < 2).length} more).`
    );
  const missing = report.apps.filter(app => app.missing).map(app => app.repo);
  if (missing.length)
    lines.push("", `Not scanned (no clone; run \`fetch\`): ${missing.join(", ")}.`);
  return lines.join("\n") + "\n";
}

const manifest = readJson(manifestPath);
const command = args[0];
if (command === "fetch" || command === "pin") {
  for (const app of manifest.apps) {
    const { status, head } = checkout(app, command === "pin" ? "HEAD" : app.sha);
    if (command === "pin" && head && head !== app.sha) {
      console.log(`${app.repo}: ${app.sha.slice(0, 7)} → ${head.slice(0, 7)}`);
      app.sha = head;
    } else console.log(`${app.repo}: ${command === "pin" && head ? "unchanged" : status}`);
  }
  if (command === "pin") writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
} else if (command === "scan") {
  const apps = manifest.apps.map(scanApp);
  const names = new Set(apps.flatMap(app => app.deps ?? []));
  const report = {
    date: new Date().toISOString().slice(0, 10),
    dir: relative(root, dir).startsWith("..") ? "(outside the repo)" : relative(root, dir),
    npm: args.includes("--npm") ? await npmReadiness(names) : null,
    apps
  };
  const text = markdown(report);
  if (args.includes("--write")) {
    writeFileSync(join(docs, "report.json"), JSON.stringify(report, null, 2) + "\n");
    writeFileSync(join(docs, "report.md"), text);
    console.log("wrote documentation/corpus/report.{json,md}");
  } else process.stdout.write(text);
} else {
  console.error("usage: node scripts/corpus.mjs <fetch|pin|scan> [--dir D] [--npm] [--write]");
  process.exit(2);
}
