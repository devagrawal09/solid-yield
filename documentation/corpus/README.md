# App corpus

Sugar mode aims to be the target for migrating Solid 1 apps to Solid 2. What the compiler accepts is meant to be a strict subset of what runs as plain Solid 2. So code that passes the compiler should also run, unchanged, without it. This corpus is the set of real open-source apps that claim is tested on. Apps come first; libraries can follow.

Each app is used in three versions:

1. **The Solid 1 original**, at the pinned commit. This is the behavior reference.
2. **The Solid 2 migration as plain Solid**, which is the code a migration PR would contain.
3. **The same code through solid-yield**, which is the check.

Comparing 2 with 1 shows the migration kept the app's behavior. Comparing 3 with 2 shows the compiler agrees with plain Solid. The compiler's diagnostics on 3 are what an agent fixes while migrating. The comparisons reuse the twins' parity approach: one script drives both apps, and the DOM is compared after each step.

## What is in it

[apps.json](apps.json) pins 28 apps. Each entry lists the Solid packages that make up the app (`paths`) and the Solid code left out, with the reason (`outOfScope`), for example opencode's terminal UI, which uses a non-DOM renderer. [report.md](report.md) holds the measurements. In total there are 6,703 Solid files and 1.34 M lines, on solid-js 1.3 to 1.9.

To be included, an app must:

- be open source on GitHub
- be an app, not a library
- render to the DOM
- depend on solid-js at its pinned commit

Candidates came from the [made-in-solid](https://github.com/solidjs-community/made-in-solid) list, web searches, and opencode and macro by name. `excluded` in apps.json records the candidates that failed the test and why. For example, metacubexd moved to Vue and openwork to React.

| Tier (lines in Solid files) | Apps |
| --- | --- |
| Large (over 40k) | macro, opencode, Cap, parallel-code, Nerimity, Stoat (`for-web`), vrite |
| Medium (5k–40k) | monkeytype, SST Console, alist-web, threadclient, aoe4world explorer, codeimage, relagit, solid-playground |
| Small (under 5k) | solid-site, ambient, solid-docs, html-to-solidjsx, DevsPlayingPoker, bundle, bauble, opencode-web, dropcode, yal, solid-realworld, clips, solid-hackernews |

## First findings (report of 2026-10-10)

- **The same few changes are needed almost everywhere.**
  - Every app imports `solid-js/web` (469 files); its contents move to `@solidjs/web`.
  - 27 apps call one-argument `createEffect`, 2,430 calls in all. That form is gone in Solid 2.
  - Next come `onMount` (24 apps), `classList` (20), the `on` helper (19 apps, 821 uses), `Context.Provider` (19), `batch` (17) and `createResource` (16 apps, 212 uses).
  - Most of these are mechanical. The `createEffect` split and `createResource` (rewritten as an async computation under `Loading`) are where the compiler's checks matter most.
- **Dependencies block more than app code does.**
  - 51 of the 136 third-party Solid packages have a release that declares solid-js 2.
  - No `@solidjs/start` release declares Solid 2: 2.0.6 targets `solid-js ^1.9.15`. That holds back the SolidStart apps (Cap, opencode's console, enterprise and stats sites, solid-docs).
  - `@solidjs/router` 2.0.0-next.38 asks for solid-js `^2.0.0-rc.14`, while this repo is held on rc.13.
  - Kobalte's 2.0 alpha pins rc.3.
- **Few apps have behavior tests.** Only five ship an end-to-end config: opencode, macro, Stoat, parallel-code and clips. For the rest, the behavior scripts have to be written against the Solid 1 app first.
- **Licenses vary.**
  - 14 apps are MIT.
  - macro, Cap, Stoat and vrite are AGPL-3.0; monkeytype and Nerimity are GPL; relagit is LGPL.
  - Six have no license file: SST Console, opencode-web, solid-docs, threadclient, DevsPlayingPoker and yal.
  - That is why the clones live outside this repo and nothing from them is vendored here.

## Where to start

1. **Small apps whose dependencies are ready.** solid-hackernews, solid-realworld, clips (which has e2e tests), bauble and opencode-web. They exercise the pipeline end to end at low cost.
2. **aoe4world explorer.** It is medium-sized, both its Solid dependencies are ready, and it has 39 `createResource` uses, which makes it the best test of the async rewrite.
3. **Medium apps,** then **large apps one slice at a time** (a route or package, not the whole repo).
4. **SolidStart apps** once SolidStart has a release for Solid 2.

## Migration trials

[migrations/](migrations/README.md) records the first trials (2026-10-10):

- **solid-realworld, aoe4world explorer and opencode-web**, each migrated to Solid 2 with sugar mode as the verifier.
- **The results:** the per-app reports, 56 repros, and patches for the two MIT apps.
- **The main finding:** all three apps run as plain Solid 2. The strict-subset claim held for two of them and broke in three reproduced cases in opencode-web.

## Running it

```sh
node scripts/corpus.mjs fetch                 # shallow-clone every app at its pin
node scripts/corpus.mjs scan --npm --write    # rewrite report.md and report.json
node scripts/corpus.mjs pin                   # move pins to each default branch; scan again after
```

Clones go to `../solid-yield-corpus/<owner>/<repo>`; set `--dir` or `$SOLID_YIELD_CORPUS` to change that. The full set is about 2 GB. `--npm` reads the npm registry. The report is outside the gate.

## Limits of the measurements

- **Counts come from text matching, not types.**
  - An API name counts only when the file imports it from solid-js, and calls may pass type arguments.
  - Re-exports through the app's own modules are not followed, so those uses are missed.
  - The destructured-props count is a heuristic.
  - Line counts include comments and blank lines.
- **Test, spec and story files are left out of the Solid counts.** They will still need migrating.
- **Behavior changes with no syntax of their own are not counted.** Examples: writes inside owned scopes, reads at the top of a component body, setters that apply on the next microtask. Those are what the compiler and the runtime diagnostics are for.
- **Router and SolidStart data APIs are listed but not judged.** Their Solid 2 forms belong to those packages.
- **"Has a Solid 2 release" reads only the declared range.** A release that targets an older rc is not shown to work on rc.13.
