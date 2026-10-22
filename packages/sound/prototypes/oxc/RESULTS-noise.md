# C / oxc — whole-app noise round

**Partial improvement; precision remains unmeasured for the app as a whole.** Same 2,669 roots and 524,547 LOC: **5,599 → 4,862 errors**, **13,025 → 12,169 warnings**, **516 → 532 infos**. There are 1,360 removed and 623 added error locations, not 737 proved fixes to application bugs. Unknown callbacks and unsupported/budget fallbacks remain active. B and C remain available; B was not edited.

## Conditions and raw evidence

- Branch `solid-sound-oxc-noise`, base `f38b2bc760e9a1dd07283ed4fa9564139304f5f8`. Input is `/Users/devagr/solid-yield-wt/openclaw-trial/app`, read-only untrusted data. Source comments/instructions were ignored. No OpenClaw imports, scripts, hooks, builds or tests ran; trusted checker parsing only.
- Dependencies installed using `pnpm install --frozen-lockfile --prefer-offline --ignore-scripts`. No dependency, rc.16 application installation, roots, exclusion, compiler option, work budget, severity, shared fixture, pin, harness, src, decision or other prototype was changed.
- Source inventory: 2,669 checked roots; 3,413 exclusions; 524,547 checked-root LOC; 8,511 loaded graph entries. The exact root-path set hashes agree: `0c5e2e8a6672a680668417551bddd0b363f731412d743a4f4a4c38c87143c14e`.
- Fresh workers use `--max-old-space-size=2048`, 90 s timeout and detached process-group cleanup. Each app/check/test job was awaited before the next heavy checker started. Vitest used one worker with file parallelism disabled. No jobs remain pending.
- `noise-before.json.gz` / `noise-after.json.gz` retain every raw diagnostic code, severity, location, owner path, related location and data, plus all inference and worst-case sites. Repeated origin objects are stored once in an indexed table. Messages/kinds are recoverable from the unchanged shared code table. No findings were filtered. `noise-removed-errors.json.gz` preserves removed error locations and origins.
- Raw full runs: `/private/tmp/oxc-noise/before.json` (original C), `before-origins.json` (identical counts, added evidence), `after-reviewed.json` (final). Process logs are adjacent. Raw/compact SHA256 values, code/root-cause counts and inventory are in `noise-measurements.json`. These paths are local scratch, not portable source dependencies.
- The evidence-only baseline run exactly reproduces the original counts. Its older encoding used JSON strings for origins; final origins are shared location objects so comment-only update relocation stays correct. Origin metadata supplies evidence only; it never discharges a failure or changes severity.

## Supported semantic fixes and paired controls

All new controls live in `noise.test.mjs` (15 tests); frozen tests are unchanged.

| Fix | Clean control | Positive mutant / protection |
|---|---|---|
| Short-circuit and conditional execution | `false && fail()`, `true || fail()`, `42 ?? fail()`, untaken ternary arm | Flip the deciding literal: throwing branch reports. Unknown boolean/scalar/template inputs retain both arms. |
| Branch-local caller/callee cells | A definitely executed assignment replaces a throwing closure | Unknown `flag && (f=safe)` preserves the skipped throwing closure; joining occurs after the fork. |
| Native array result facts | `slice`, `concat`, `at`, `pop`, `shift`, `Array.from`, including its mapper, retain safe callback bodies | Same arrays with throwing callbacks report; injected lookalike methods and annotation-only callbacks remain unknown. Removed elements remain in the abstract receiver as a conservative overapproximation. |
| Native string result provenance | Native `slice/trim/toLowerCase/split`, array `join`, and split/pop chains preserve string/array shapes | Throwing downstream map callback and injected slice/trim methods report. No method-name-only exemption was added. |
| Lazy prop failures are separate from reactivity | A caught `props.value` whose caller expression only throws has no strict-read error | Replace caller expression with a signal read: STRICT_READ_UNTRACKED. Remove catch: SETUP_MAY_THROW. JSX still reports the failure at the child read with caller expression related. |

An interpolated template is an abstract string, not the old known empty-string placeholder. That correction is necessary before using truth values to prune branches. Public optional injected callbacks still may fail under D-129. Annotation-only functions still have unknown failures. Installed implementation bodies remain excluded, including linked packages; installed-path diagnostics are zero. C imports neither TypeScript nor another prototype.

## Timing, memory and coverage

| Measurement | Original fresh C | Evidence baseline | Final C |
|---|---:|---:|---:|
| Cold check seconds | 29.53 | 31.20 | 35.52 |
| Peak RSS through check, MiB | 2318.42 | 2249.69 | 2328.94 |
| Process peak through evidence export/dispose, MiB | 2595.14 | 2418.06 | 2804.66 |
| Inference-needed requests | 57346 | 57346 | 55810 |
| Inference locations | 41289 | 41289 | 40115 |
| Worst-case spans | 30760 | 30760 | 30262 |
| Budget-hit AST sites | 7909 | 7909 | 7984 |

These are single warm-filesystem cold-check runs on Node v24.18.0 / arm64 / Apple M4 Pro, not medians. The historical scale run was 27.68 s / 2249.33 MiB sampled worker RSS; do not replace it with a later run. The new checker is slower on these measurements. The V8 cap is not a total-memory cap; RSS is still above 2 GiB. `ps` sampling is denied in this sandbox, so the driver sampled RSS fields are zero/unavailable. The table uses Node resourceUsage.maxRSS captured immediately after check and later at process completion; the latter includes large raw evidence serialization. No sampled-zero RSS is reported as a successful measurement.

## Counts by diagnostic code

| Code : severity | Before | After |
|---|---:|---:|
| ASYNC_OUTSIDE_LOADING_BOUNDARY:error | 557 | 485 |
| COMPONENT_OBLIGATIONS_EXPORTED:info | 516 | 532 |
| CONTEXT_PROVIDER_MISSING:error | 5 | 5 |
| ERROR_OUTSIDE_ERRORED_BOUNDARY:error | 1195 | 975 |
| PENDING_ASYNC_FORBIDDEN_SCOPE:error | 1292 | 1059 |
| PENDING_ASYNC_IN_HANDLER:warn | 2288 | 1469 |
| PENDING_ASYNC_UNTRACKED_READ:error | 410 | 388 |
| REACTIVE_WRITE_IN_OWNED_SCOPE:error | 2 | 2 |
| SETUP_MAY_THROW:error | 621 | 542 |
| STRICT_READ_UNTRACKED:error | 74 | 39 |
| UNANALYZED_BOUNDARY:warn | 10737 | 10700 |
| UNHANDLED_HANDLER_FAILURE:error | 1443 | 1367 |

## Root-cause ranking

`noise-summarize.mjs` classifies recorded source origins, not just codes. The following are exclusive buckets: budget first, unsupported boundary next, annotation-only unknown, unresolved callable/receiver, platform, other unknown, modeled throw, source facts, then untraced. A mixed origin set belongs to its first applicable bucket; it can contain additional independent obligations. This is a reproducible coarse causal partition, not exhaustive source-level proof. Pending-source and untraced buckets explicitly retain that uncertainty.

| Root cause (errors) | Before | After |
|---|---:|---:|
| work or alternatives budget fallback | 2384 | 2360 |
| unresolved callable or receiver facts | 1145 | 972 |
| annotation-only failure obligation | 634 | 622 |
| pending source origin not further traced | 929 | 433 |
| unsupported construct or missing dependency declaration | 192 | 199 |
| unmodeled platform contract | 103 | 103 |
| unknown failure origin not further traced | 101 | 96 |
| pending memo result without traced fallback | 17 | 35 |
| settled reactive source read | 71 | 26 |
| obligation without recorded origin | 12 | 8 |
| missing provider in analyzed render path | 5 | 5 |
| setter invoked in owned scope | 2 | 2 |
| project throw or modeled failure | 4 | 1 |

Every error remains emitted. Counts are obligations, not proved app defects. The largest direct cause remains bounded analysis, followed by unresolved callable/receiver provenance and annotation-only contracts. Native result shapes and branch/prop facts remove justified local false-positive mechanisms; they do not justify trusting all opaque receivers.

| Classification of all diagnostic records | Before | After |
|---|---:|---:|
| direct boundary | 10737 | 10700 |
| direct or untraced obligation | 6186 | 4314 |
| downstream obligation | 1701 | 2017 |
| summary | 516 | 532 |

Downstream means a recorded origin is at a different source span; same-span or missing origins remain grouped as direct/untraced. The final run has 0 exact duplicate code/location records. 2331 diagnostics share 967 repeated origin sets. Sharing causes is cascade evidence, not permission to merge independent read, handler, pending and failure obligations. No such merger was made.

### Representative source chains

- **Real supported setter:** `chat-message-text-view.tsx:286` calls the returned markdown closure during component setup → `markdown-dom-ref.ts:45` calls `setOwner`. E26 is required by the frozen setup-write rule. `ownedWrite` policy remains deferred.
- **Memo setter:** `session-hovercard-automations.tsx` source memo → `projectSource` → synchronous subscribe/reset/notify → `projection.ts:83` setter. E27 is a distinct owned-compute write, not a duplicate of E26.
- **Contract-required unknown:** `chat-details-mobile-content.tsx:317` handler → `props.content.entries.onNavigate` at 318; no safe analyzed body/catch. E38 remains required. The same reasoning applies to optional `props.ref` at `router-outlet.tsx:483` (E40).
- **Budget cascade:** `parse-output.ts:617` ordinary counter update or `browser-tab-card.tsx:269` JSX expansion → file-budget worst case → pending and failure obligations in the current render scope. No actual async accessor is proved at the counter update.
- **False strict-read mechanism fixed:** a caller prop expression invokes a plain throwing helper → capture has failures but no reactive read → old code called `read()` and invented STRICT_READ_UNTRACKED in the child. C now routes only the failure through the child scope; the paired catch/signal/missing-catch controls pin the distinction.
- **Unresolved provenance:** `message-normalizer.ts:280` string split/pop/trim still receives opaque caller facts; literal/known-native controls now work. `user-identity.ts:22` also loses literal-regexp receiver provenance, with an opaque installed-package result as input. E14/E15 remain candidate false positives; names and parameter annotations are not used to erase those opaque facts.
- **Deferred phase:** `channels-page.tsx:208` has a real signal read, but the helper is reached from onSettled/subscriptions; `desktop-panel-rail.tsx:94` similarly reads inside onSettled. Current C maps that phase to effect; it does not establish the deferred rule. These are explicitly unresolved scope limitations, not confirmed supported-code bugs.

## AFTER source review

Per error code: SHA256(code:trial-relative-file:line:col), first two changed findings plus first unchanged findings, up to five. Changed means new site or changed normalized origin set/data. No verdict influenced selection.

42 errors across all nine error codes; 14 have changed origin/data sets and 28 are unchanged. Static source review only. Verdicts: **7 TP, 0 confirmed FP, 35 UNSURE**. Of the TPs, **2 follow supported setter rules and 5 are D-129 unknown-failure contracts**; none is presented as an observed production failure. UNSURE findings stay visible and their worst-case requirements remain. This audit is not a precision rate. Actual pre-fix false-positive mechanisms are demonstrated by the paired local negative controls, not inferred from the net count.

Full source snippets, hashes, origin references, separate contract status and reasons for every row are in `noise-error-review.json`.

| ID | Source (relative to trial) | Verdict | Contract / reason |
|---|---|---|---|
| E01 | app/src/pages/chat/components/chat-reply-attribution.tsx:25:35 | UNSURE | required-worst-case: Boolean/prop comparison itself does not establish pending. |
| E02 | app/src/pages/chat/components/chat-forwarded-attribution.tsx:150:39 | UNSURE | required-worst-case: Route URL construction observes upstream memo/prop facts. |
| E03 | src/media/parse-output.ts:617:9 | UNSURE | required-worst-case: The primary site increments a rejection counter in media parsing. |
| E04 | src/shared/chat-envelope.ts:36:12 | UNSURE | required-worst-case: The helper returns its text parameter; pending originates in propagated unknown input facts. |
| E05 | app/src/pages/chat/components/browser-tab-card.tsx:269:11 | UNSURE | required-worst-case: The JSX container is a file-budget boundary. |
| E06 | app/src/pages/new-session/composer-capability-controls.tsx:99:20 | UNSURE | provider-path-unresolved: useContext has no usable default in this analyzed path. |
| E07 | app/src/pages/new-session/composer-capability-controls.tsx:57:20 | UNSURE | provider-path-unresolved: The composer menu reads the textarea context. |
| E08 | app/src/pages/new-session/composer.tsx:371:20 | UNSURE | provider-path-unresolved: The composer consumes its textarea context directly. |
| E09 | app/src/lib/reactive/context.ts:107:10 | UNSURE | provider-path-unresolved: useApplication calls useContext, while useOptionalApplication below catches ContextNotFoundError. |
| E10 | app/src/components/image-lightbox-content.tsx:40:16 | UNSURE | provider-path-unresolved: ImageLightboxContent reads a host context without a local default. |
| E11 | app/src/pages/chat/components/chat-source-previews.tsx:127:24 | UNSURE | required-worst-case: For forwards sources into SourceCard; origins contain upstream projection and work-budget fallbacks. |
| E12 | src/auto-reply/reply/strip-inbound-meta.ts:179:19 | UNSURE | required-worst-case: A string lastIndexOf inside a metadata scanning loop is reached after exhausted work. |
| E13 | app/src/lib/chat/message-normalizer.ts:194:27 | TP | required-unknown-failure: asFiniteNumber is imported from an installed normalization package. |
| E14 | app/src/lib/chat/message-normalizer.ts:280:18 | UNSURE | required-unknown-failure: The source operation is url.split(...).pop()?.trim() on a string parameter. |
| E15 | app/src/app/user-identity.ts:22:7 | UNSURE | required-unknown-failure: The receiver is a native regexp literal, but trimmed comes from an installed normalizeOptionalString call whose declaration/result is unavailable here. |
| E16 | app/src/pages/sessions/sessions-page.tsx:44:23 | UNSURE | required-worst-case-and-deferred-phase: The read is inside onSettled; that phase is deferred in FUTURE. |
| E17 | app/src/features/github-connections/github-identity.ts:203:7 | UNSURE | required-worst-case: deviceAuthorization.retire(true) is an imperative operation. |
| E18 | app/src/pages/config/appearance-background-state.ts:214:22 | UNSURE | required-worst-case: The conditional builds an image-read identity inside preview work. |
| E19 | app/src/lib/system-info.ts:31:10 | UNSURE | required-worst-case: canCallGatewayMethod is a synchronous capability check. |
| E20 | app/src/pages/skills/skills-page.tsx:385:5 | UNSURE | required-worst-case: setSkillsAgentId receives agentSelection().state. |
| E21 | app/src/pages/chat/chat-page-pane-render.tsx:362:13 | UNSURE | required-worst-case: This Show occurs in a keyed row JSX expression, which normally tracks. |
| E22 | app/src/components/panel-tab-strip-solid.tsx:140:19 | UNSURE | required-worst-case: groupRef runs as a ref, so real pending prop reads would violate D-131. |
| E23 | app/src/components/app-sidebar-session-filter-summary.tsx:160:12 | UNSURE | required-worst-case: An Icon element is a bounded component invocation. |
| E24 | app/src/components/solid/identity-avatar.tsx:36:20 | UNSURE | required-worst-case: projectSource creates the branding projection. |
| E25 | app/src/pages/chat/chat-avatar-view.tsx:221:20 | UNSURE | required-worst-case: The same projection pattern is instantiated for a local avatar. |
| E26 | app/src/components/markdown-dom-ref.ts:45:5 | TP | supported-rule-with-ownedWrite-deferred: MarkdownContent calls markdown(fragment) synchronously in setup (chat-message-text-view.tsx:286). |
| E27 | app/src/lib/reactive/projection.ts:83:5 | TP | supported-rule-with-ownedWrite-deferred: SessionHovercardAutomations source memo creates projectSource; its subscribe body calls reset synchronously, reset calls notify, and projection.publish calls setRevision here. |
| E28 | app/src/pages/chat/components/chat-sidebar-file-view.tsx:226:16 | UNSURE | required-worst-case: The Icon invocation reaches its function budget during setup expansion. |
| E29 | app/src/app/shell-assistant-toggles.tsx:11:10 | UNSURE | required-worst-case: ShortcutHint is bounded while consuming label/combo props. |
| E30 | app/src/components/solid/mcp-app-panel.tsx:42:19 | UNSURE | required-worst-case: projectGateway forwards through projectOwner/projectSource. |
| E31 | app/src/pages/chat/components/session-diff-render.tsx:34:25 | UNSURE | required-worst-case: A conditional DiffFoldToggle invocation is widened at its function budget. |
| E32 | app/src/pages/usage/view-query-filter.tsx:53:6 | UNSURE | required-worst-case: Menu props/spreads lead into bounded component analysis. |
| E33 | app/src/pages/chat/components/chat-pull-request-checks.tsx:57:10 | UNSURE | deferred-phase-plus-unsupported-source: sync(props.presented, props.dismissed) is called from onSettled. |
| E34 | app/src/pages/model-providers/profiles-view.tsx:505:25 | UNSURE | deferred-phase: profile() reads a row prop derived from a reactive row (origin profiles-view.tsx:481), but this consumption is in onSettled. |
| E35 | app/src/pages/channels/channels-page.tsx:208:23 | UNSURE | deferred-phase: pairingChannelFilter is a real settled signal. |
| E36 | app/src/components/config-form.node.collection-map.tsx:237:42 | UNSURE | deferred-phase: The keyed entry accessor flows through focus.row and focus.register. |
| E37 | app/src/components/desktop/desktop-panel-rail.tsx:94:28 | UNSURE | deferred-phase: mobile() is read inside onSettled in DesktopConnectionRail. |
| E38 | app/src/pages/chat/components/chat-details-mobile-content.tsx:317:13 | TP | required-unknown-failure: The handler calls props.content.entries.onNavigate without a catch. |
| E39 | app/src/pages/cron/scratch-editor.tsx:260:13 | UNSURE | required-worst-case: loadScratch is an async handler. |
| E40 | app/src/app/router-outlet.tsx:472:7 | TP | required-unknown-failure: The ref eventually invokes props.ref?.(readinessHost) (router-outlet.tsx:483). |
| E41 | app/src/pages/chat/components/chat-composer-pasted-text.tsx:75:7 | TP | required-unknown-failure: showPastedTextInComposer invokes removeDraftAttachment and optional onDraftChange/getDraft APIs without a handler catch. |
| E42 | app/src/pages/chat/components/chat-sidebar-desktop-frame-controls.tsx:189:11 | TP | required-unknown-failure: The optional callbacks.setOpen(false) call is uncaught. |

### Fifteen silence sites

Eleven changed native-string/array operations chosen from removed-error locations, plus four unchanged import/catch/reset/boundary controls. Sites were fixed before the last rerun; all require zero AFTER error starts on their source line. Multiple controls in one component exercise different obligations. This is a risk-based audit, not a random sample.

Here TP means correct silence for the inspected operation, FP would mean a missed required finding. All 15 are TP for their narrow operation; this does not certify enclosing functions/files. Existing warnings and findings elsewhere remain. Every site was checked against the final full error list. Full source hashes and contract statuses are in `noise-silence-review.json`.

| ID | Source | Verdict | Reason |
|---|---|---|---|
| S01 | app/src/app-route-paths.ts:554 | TP | Native lower-case/endsWith chain on normalized path; the previous unknown call came from losing the string result. |
| S02 | app/src/app-route-paths.ts:560 | TP | Native split/filter with Boolean predicate; no injected callback is called here. |
| S03 | app/src/app-route-paths.ts:562 | TP | Native slice/join on the local segments array; loop coverage warnings remain separate. |
| S04 | app/src/pages/usage/helpers.ts:7 | TP | String conversion and padStart format numeric date fields; no callback or reactive getter is invoked. |
| S05 | app/src/pages/plugin/logbook-state.ts:15 | TP | Native Date.getMonth followed by String/padStart; native return shape remains distinct from injected methods. |
| S06 | app/src/pages/plugin/logbook-state.ts:16 | TP | Native Date.getDate followed by String/padStart; no failure obligation under the slice platform model. |
| S07 | src/media/parse-output.ts:325 | TP | String.slice extracts a gap from a string parameter. Surrounding loop/call obligations are independent. |
| S08 | app/src/lib/browser-redact.ts:64 | TP | Native slices and a template construct the masked text; no callback invocation at this site. |
| S09 | app/src/lib/browser-redact.ts:46 | TP | Conditional string.slice uses a known string input; unknown numeric offset changes only the chosen substring. |
| S10 | app/src/lib/browser-redact.ts:60 | TP | Native lastIndexOf on the matched string; no failure-producing operation in this expression. |
| S11 | app/src/lib/browser-redact.ts:53 | TP | String startsWith under a token comparison; neither native test can throw under the string receiver model. |
| S12 | app/src/components/plugin-theme-artwork.tsx:7 | TP | Dynamic import stays a partial-check warning, and the enclosing try/catch handles its failure. No application import was executed in this review. |
| S13 | app/src/components/plugin-theme-artwork.tsx:9 | TP | Awaited opaque loader call is inside try/catch, which returns null on failure; the unknown failure contract is discharged. |
| S14 | app/src/components/plugin-theme-artwork.tsx:15 | TP | Loading.on is a reset input, not an event binding; a URL does not create a handler obligation. |
| S15 | app/src/components/plugin-theme-artwork.tsx:16 | TP | Async memo source is consumed beneath Loading; its body catches loader failures, so this read needs no escaping error. |

## Unsupported coverage and remaining limits

All existing boundary warnings and worst-case fallbacks remain. Below are direct partial warnings by construct, not downstream totals. Reductions/additions include changed reachability and changed budget consumption. Budget limits were not raised.

| Construct | Before | After |
|---|---:|---:|
| JSX spread | 403 | 384 |
| Solid action is outside the modeled subset | 89 | 88 |
| Solid children is outside the modeled subset | 9 | 9 |
| Solid createComponent is outside the modeled subset | 1 | 1 |
| Solid createDeferred is outside the modeled subset | 15 | 16 |
| Solid createErrorBoundary is outside the modeled subset | 1 | 1 |
| Solid createLoadingBoundary is outside the modeled subset | 2 | 2 |
| Solid createOptimistic is outside the modeled subset | 109 | 108 |
| Solid createOptimisticStore is outside the modeled subset | 10 | 10 |
| Solid createProjection is outside the modeled subset | 5 | 5 |
| Solid createStore is outside the modeled subset | 42 | 42 |
| Solid createUniqueId is outside the modeled subset | 42 | 42 |
| Solid dynamic is outside the modeled subset | 17 | 16 |
| Solid flush is outside the modeled subset | 1 | 0 |
| Solid getObserver is outside the modeled subset | 1 | 1 |
| Solid getOwner is outside the modeled subset | 5 | 5 |
| Solid isPending is outside the modeled subset | 78 | 75 |
| Solid latest is outside the modeled subset | 66 | 63 |
| Solid lazy is outside the modeled subset | 59 | 59 |
| Solid mapArray is outside the modeled subset | 3 | 3 |
| Solid omit is outside the modeled subset | 4 | 4 |
| Solid reconcile is outside the modeled subset | 1 | 1 |
| Solid refresh is outside the modeled subset | 1 | 1 |
| Solid runWithOwner is outside the modeled subset | 2 | 3 |
| Solid spread is outside the modeled subset | 1 | 1 |
| Solid template is outside the modeled subset | 1 | 1 |
| class construction | 161 | 157 |
| derived signal | 45 | 45 |
| dynamic or unmodeled JSX | 150 | 171 |
| file work budget exhausted | 5435 | 5476 |
| function work budget exhausted | 2239 | 2118 |
| installed dependency has no declaration | 51 | 46 |
| loop state needs a fixed-point analysis | 776 | 720 |
| merge source shape needs inference | 344 | 312 |
| module reactive state | 2 | 2 |
| reactive write in ref: ownership is not modeled | 21 | 19 |
| recursive call needs a wider summary | 53 | 43 |
| unknown For key mode | 0 | 1 |
| unmodeled expression ImportExpression | 37 | 36 |
| unmodeled expression MetaProperty | 5 | 5 |
| unmodeled expression SpreadElement | 1 | 1 |
| unmodeled expression YieldExpression | 3 | 3 |
| unmodeled statement TSEnumDeclaration | 1 | 1 |
| unmodeled statement TSModuleDeclaration | 147 | 147 |
| unsupported class shape | 189 | 189 |
| value alternatives exceed summary budget | 109 | 267 |

- **Unmet:** high app-wide precision and complete causal attribution. Thousands of budget/unknown obligations remain. The 35 uncertain reviewed errors cannot be relabeled as true bugs or false positives from their codes/counts.
- Origins are evidence, not a complete causal graph: async rejections, caught/rethrown failures and some propagated pending sources stop at a consumer or summary. Coarse buckets include mixed causes. No exhaustive TP/FP verdict is claimed for all 4,862 errors.
- onSettled scope/cleanup/ownership stays deferred. Existing C treats it as effect; this can produce scope findings without a distinct phase-boundary warning. That pre-existing coverage gap is documented rather than silently redefined in this prototype-local noise pass. Native regexp literals, missing declaration result shapes, spreads, loops, stores/actions, object mutation and complete alias provenance remain limits.
- No output-summary propagation or incremental-latency work was attempted. No frozen expectation was weakened. Fixture success does not establish general soundness.

## Validation and reproduction

- `node harness/run.mjs`: sequential, exit 0; B and C each retain all 173 fixtures, 103/103 required error groups, 11/11 warnings, 5/5 infos, zero misses/extras/leakage/unmapped findings. The null checker still reports expected misses.
- `pnpm test --maxWorkers=1 --no-file-parallelism`: sequential after the harness, exit 0; **335 tests, 21 files**, including 15 new noise tests. Original test expectations remain unchanged. The TypeScript-blocked loading test still passes.
- An intermediate package run caught stale origin positions after comment-only updates. It failed 1 test; shared cached location objects fixed it. The original location regression test was not changed. Final logs and summaries are in `noise-validation.json` and `/private/tmp/oxc-noise/{harness-reviewed,tests-reviewed}.{json,log}`.
- No `results/latest.*` file is part of this change. Raw profiling/debug dumps remain in scratch; the compressed evidence above is portable. Local commit only; no push.

From the repository root, with Node 24 on PATH:

```sh
node packages/sound/scale/oxc/noise-run.mjs --diagnostics --timeout 90 --output /private/tmp/oxc-noise/after-reviewed.json
node packages/sound/scale/oxc/noise-summarize.mjs /private/tmp/oxc-noise/before-origins.json /private/tmp/oxc-noise/after-reviewed.json packages/sound/prototypes/oxc
cd packages/sound
node scale/oxc/noise-job.mjs 300 /private/tmp/oxc-noise/harness node harness/run.mjs
node scale/oxc/noise-job.mjs 300 /private/tmp/oxc-noise/tests pnpm test --maxWorkers=1 --no-file-parallelism
```

To reproduce original before counts, run the same parse-only driver against base f38b2bc before applying semantic fixes. The committed compact before evidence preserves the original diagnostics; the original uninstrumented baseline is separately recorded in noise-validation.json. To inspect a packed file, use Node zlib.gunzipSync or `gzip -dc`; never import files from the trial app.
