# C1 analysis prototype

Status: diagnostic prototype; not a completed C1 or a codegen input. Counts are static sites, not dynamic islands. The implementation limits below prevent a C0 premise verdict.

Definitions actually used: S < U < C, join=max; written cells C; unproved calls/imports U; props joined across call sites (cap 1); contexts joined over all resolved providers. Every effect forces eager. Unproved setup work forces an eager fallback. Merge counts count distinct reported pairs, not successful union operations. SPAN_OVERLAP and CAPTURE_FALLBACK are listed separately from M1-M6. Capture failures describe candidate edges, not emitted edges. JSX fractions exclude h element sites; markup bytes are not measured.

| Twin | Inert holes | Inert JSX elements | Candidate roots (parts; mode) | M1/M2/M3/M4/M5/M6 | Capture candidates | U sources | Effects |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: |
| effect-yield | 8/69 | 24/77 | 101 eager, 1 visible | 877/10/0/13/55/830 | 6 | 57 | 0 |
| hackernews-spa-yield | 28/70 | 43/66 | 16 visible, 33 visible, 13 visible, 1 lazy | 326/1/0/32/16/388 | 0 | 12 | 0 |
| rendering-yield | 12/124 | 55/114 | 58 visible, 4 eager, 16 eager, 16 visible, 15 visible, 2 lazy, 43 visible, 9 visible, 8 lazy, 1 lazy | 560/13/3/14/63/566 | 5 | 55 | 1 |
| room-yield | 23/96 | 30/75 | 122 eager | 1141/20/3/13/11/3921 | 10 | 47 | 1 |
| sierpinski-yield | 0/26 | 0/2 | 40 eager | 510/4/0/4/16/351 | 1 | 2 | 0 |
| sierpinski-yield-h | 0/6 | 0/0 | 25 eager | 154/4/0/1/1/91 | 1 | 4 | 0 |
| todos-yield | 6/34 | 4/29 | 57 eager | 765/59/55/3/20/1410 | 1 | 44 | 1 |
| todos-yield-h | 5/16 | 0/0 | 36 eager | 111/11/0/0/7/146 | 2 | 52 | 1 |

## effect-yield

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: eager, 101 parts; span examples/effect-yield/src/app.tsx:89:7; components LogPanel, App, Typeahead, Checkout, Results, Orders; sites examples/effect-yield/src/app.tsx:26:30, examples/effect-yield/src/app.tsx:29:17, examples/effect-yield/src/app.tsx:80:32, examples/effect-yield/src/app.tsx:81:25, examples/effect-yield/src/app.tsx:84:24, examples/effect-yield/src/app.tsx:100:17, examples/effect-yield/src/typeahead.tsx:94:36, examples/effect-yield/src/typeahead.tsx:99:26, examples/effect-yield/src/typeahead.tsx:108:19, examples/effect-yield/src/log.ts:25:40, examples/effect-yield/src/log.ts:26:18, examples/effect-yield/src/log.ts:32:17, examples/effect-yield/src/checkout.tsx:123:34, examples/effect-yield/src/checkout.tsx:126:27, examples/effect-yield/src/checkout.tsx:135:36, examples/effect-yield/src/checkout.tsx:138:48, examples/effect-yield/src/checkout.tsx:140:24, examples/effect-yield/src/checkout.tsx:187:27, examples/effect-yield/src/checkout.tsx:190:17, examples/effect-yield/src/checkout.tsx:199:18, examples/effect-yield/src/checkout.tsx:202:25, examples/effect-yield/src/checkout.tsx:223:35, examples/effect-yield/src/checkout.tsx:229:35, examples/effect-yield/src/checkout.tsx:297:38, examples/effect-yield/src/app.tsx:37:28, examples/effect-yield/src/app.tsx:40:11, examples/effect-yield/src/app.tsx:40:18, examples/effect-yield/src/app.tsx:51:21, examples/effect-yield/src/app.tsx:51:28, examples/effect-yield/src/app.tsx:56:47, examples/effect-yield/src/app.tsx:57:55, examples/effect-yield/src/app.tsx:58:55, examples/effect-yield/src/app.tsx:59:54, examples/effect-yield/src/app.tsx:91:11, examples/effect-yield/src/app.tsx:91:18, examples/effect-yield/src/app.tsx:113:47, examples/effect-yield/src/app.tsx:114:36, examples/effect-yield/src/app.tsx:119:47, examples/effect-yield/src/app.tsx:120:36, examples/effect-yield/src/app.tsx:128:25, examples/effect-yield/src/app.tsx:128:32, examples/effect-yield/src/app.tsx:130:37, examples/effect-yield/src/app.tsx:133:39, examples/effect-yield/src/app.tsx:136:39, examples/effect-yield/src/app.tsx:140:24, examples/effect-yield/src/typeahead.tsx:47:43, examples/effect-yield/src/typeahead.tsx:49:11, examples/effect-yield/src/typeahead.tsx:49:18, examples/effect-yield/src/typeahead.tsx:51:23, examples/effect-yield/src/typeahead.tsx:56:21, examples/effect-yield/src/typeahead.tsx:56:78, examples/effect-yield/src/typeahead.tsx:64:21, examples/effect-yield/src/typeahead.tsx:64:28, examples/effect-yield/src/typeahead.tsx:71:57, examples/effect-yield/src/typeahead.tsx:72:57, examples/effect-yield/src/typeahead.tsx:75:50, examples/effect-yield/src/typeahead.tsx:126:18, examples/effect-yield/src/typeahead.tsx:127:20, examples/effect-yield/src/typeahead.tsx:131:11, examples/effect-yield/src/typeahead.tsx:131:18, examples/effect-yield/src/typeahead.tsx:133:23, examples/effect-yield/src/typeahead.tsx:143:23, examples/effect-yield/src/typeahead.tsx:143:30, examples/effect-yield/src/typeahead.tsx:154:33, examples/effect-yield/src/typeahead.tsx:154:40, examples/effect-yield/src/typeahead.tsx:159:47, examples/effect-yield/src/checkout.tsx:74:11, examples/effect-yield/src/checkout.tsx:74:18, examples/effect-yield/src/checkout.tsx:85:21, examples/effect-yield/src/checkout.tsx:85:28, examples/effect-yield/src/checkout.tsx:91:55, examples/effect-yield/src/checkout.tsx:95:34, examples/effect-yield/src/checkout.tsx:97:59, examples/effect-yield/src/checkout.tsx:220:13, examples/effect-yield/src/checkout.tsx:220:20, examples/effect-yield/src/checkout.tsx:238:48, examples/effect-yield/src/checkout.tsx:241:38, examples/effect-yield/src/checkout.tsx:241:59, examples/effect-yield/src/checkout.tsx:242:36, examples/effect-yield/src/checkout.tsx:246:26, examples/effect-yield/src/checkout.tsx:247:43, examples/effect-yield/src/checkout.tsx:247:69, examples/effect-yield/src/checkout.tsx:252:29, examples/effect-yield/src/checkout.tsx:252:51, examples/effect-yield/src/checkout.tsx:262:41, examples/effect-yield/src/checkout.tsx:268:45, examples/effect-yield/src/checkout.tsx:268:74, examples/effect-yield/src/checkout.tsx:272:13, examples/effect-yield/src/checkout.tsx:272:20, examples/effect-yield/src/checkout.tsx:276:52, examples/effect-yield/src/checkout.tsx:277:38, examples/effect-yield/src/checkout.tsx:283:51, examples/effect-yield/src/checkout.tsx:294:13, examples/effect-yield/src/checkout.tsx:294:20, examples/effect-yield/src/checkout.tsx:308:32, examples/effect-yield/src/checkout.tsx:309:34, examples/effect-yield/src/checkout.tsx:334:11, examples/effect-yield/src/checkout.tsx:334:18, examples/effect-yield/src/checkout.tsx:340:21, examples/effect-yield/src/checkout.tsx:340:28, examples/effect-yield/src/checkout.tsx:345:35. Fallback: unproved setup work.
- Root 2: visible, 1 parts; span unresolved; components unresolved; sites examples/effect-yield/src/solid-effect.ts:164:16.

### Additional safety merges

- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:26:30 ↔ examples/effect-yield/src/app.tsx:29:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:37:28 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:51:21 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:51:28 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:56:47 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:57:55 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:58:55 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:59:54 ↔ examples/effect-yield/src/app.tsx:26:30.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:80:32 ↔ examples/effect-yield/src/app.tsx:100:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:81:25 ↔ examples/effect-yield/src/app.tsx:100:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:84:24 ↔ examples/effect-yield/src/app.tsx:100:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:100:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:100:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:113:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:114:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:119:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:120:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:128:25.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:128:32.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:130:37.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:133:39.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:136:39.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:100:17 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:123:34 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:126:27 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:135:36 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:138:48 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:140:24 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:187:27 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:202:25.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:223:35.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:229:35.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:297:38 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:220:13.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:220:20.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:238:48.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:241:38.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:241:59.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:242:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:246:26.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:247:43.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:247:69.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:252:29.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:252:51.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:262:41.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:268:45.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:268:74.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:272:13.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:272:20.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:276:52.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:277:38.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:283:51.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:294:13.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:190:17 ↔ examples/effect-yield/src/checkout.tsx:294:20.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:308:32 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:309:34 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:334:11 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:334:18 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:340:21 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:340:28 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:345:35 ↔ examples/effect-yield/src/checkout.tsx:190:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:123:34 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:126:27 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:135:36 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:138:48 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:140:24 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:187:27 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:202:25.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:223:35.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:229:35.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:297:38 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:220:13.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:220:20.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:238:48.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:241:38.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:241:59.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:242:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:246:26.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:247:43.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:247:69.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:252:29.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:252:51.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:262:41.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:268:45.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:268:74.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:272:13.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:272:20.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:276:52.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:277:38.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:283:51.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:294:13.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:199:18 ↔ examples/effect-yield/src/checkout.tsx:294:20.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:308:32 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:309:34 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:334:11 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:334:18 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:340:21 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:340:28 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/checkout.tsx:345:35 ↔ examples/effect-yield/src/checkout.tsx:199:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:29:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:37:28 ↔ examples/effect-yield/src/app.tsx:40:11.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:40:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:51:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:51:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:56:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:57:55.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:58:55.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:11 ↔ examples/effect-yield/src/app.tsx:59:54.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:29:17.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:37:28 ↔ examples/effect-yield/src/app.tsx:40:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:51:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:51:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:56:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:57:55.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:58:55.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:40:18 ↔ examples/effect-yield/src/app.tsx:59:54.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:80:32 ↔ examples/effect-yield/src/app.tsx:91:11.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:81:25 ↔ examples/effect-yield/src/app.tsx:91:11.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:84:24 ↔ examples/effect-yield/src/app.tsx:91:11.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:91:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:113:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:114:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:119:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:120:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:128:25.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:128:32.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:130:37.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:133:39.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:136:39.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:11 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:80:32 ↔ examples/effect-yield/src/app.tsx:91:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:81:25 ↔ examples/effect-yield/src/app.tsx:91:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:84:24 ↔ examples/effect-yield/src/app.tsx:91:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:113:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:114:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:119:47.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:120:36.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:128:25.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:128:32.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:130:37.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:133:39.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:136:39.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:91:18 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:80:32 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:81:25 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:84:24 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:113:47 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:114:36 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:119:47 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:120:36 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:128:25 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:128:32 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:130:37 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:133:39 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/app.tsx:136:39 ↔ examples/effect-yield/src/app.tsx:140:24.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:49:11.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:49:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:51:23.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:56:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:56:78.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:64:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:64:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:71:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:72:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:47:43 ↔ examples/effect-yield/src/typeahead.tsx:75:50.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:49:18.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:51:23.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:56:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:56:78.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:64:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:64:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:71:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:72:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:11 ↔ examples/effect-yield/src/typeahead.tsx:75:50.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:51:23.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:56:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:56:78.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:64:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:64:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:71:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:72:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:49:18 ↔ examples/effect-yield/src/typeahead.tsx:75:50.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:51:23 ↔ examples/effect-yield/src/typeahead.tsx:56:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:51:23 ↔ examples/effect-yield/src/typeahead.tsx:56:78.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:51:23 ↔ examples/effect-yield/src/typeahead.tsx:64:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:51:23 ↔ examples/effect-yield/src/typeahead.tsx:64:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:51:23 ↔ examples/effect-yield/src/typeahead.tsx:71:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:51:23 ↔ examples/effect-yield/src/typeahead.tsx:72:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:51:23 ↔ examples/effect-yield/src/typeahead.tsx:75:50.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:21 ↔ examples/effect-yield/src/typeahead.tsx:56:78.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:21 ↔ examples/effect-yield/src/typeahead.tsx:64:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:21 ↔ examples/effect-yield/src/typeahead.tsx:64:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:21 ↔ examples/effect-yield/src/typeahead.tsx:71:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:21 ↔ examples/effect-yield/src/typeahead.tsx:72:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:21 ↔ examples/effect-yield/src/typeahead.tsx:75:50.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:78 ↔ examples/effect-yield/src/typeahead.tsx:64:21.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:64:21 ↔ examples/effect-yield/src/typeahead.tsx:64:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:64:21 ↔ examples/effect-yield/src/typeahead.tsx:71:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:64:21 ↔ examples/effect-yield/src/typeahead.tsx:72:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:64:21 ↔ examples/effect-yield/src/typeahead.tsx:75:50.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:56:78 ↔ examples/effect-yield/src/typeahead.tsx:64:28.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:64:28 ↔ examples/effect-yield/src/typeahead.tsx:71:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:64:28 ↔ examples/effect-yield/src/typeahead.tsx:72:57.
- CAPTURE_FALLBACK: examples/effect-yield/src/typeahead.tsx:64:28 ↔ examples/effect-yield/src/typeahead.tsx:75:50.

### Capture candidates

- examples/effect-yield/src/app.tsx:25:9: `entries`: setup-local value is not proved serializable at the candidate root edge.
- examples/effect-yield/src/app.tsx:79:9: `runtime`: setup-local value is not proved serializable at the candidate root edge.
- examples/effect-yield/src/app.tsx:78:9: `log`: setup-local value is not proved serializable at the candidate root edge.
- examples/effect-yield/src/checkout.tsx:146:9: `placeOrder`: setup-local value is not proved serializable at the candidate root edge.
- examples/effect-yield/src/typeahead.tsx:44:9: `searching`: setup-local value is not proved serializable at the candidate root edge.
- examples/effect-yield/src/typeahead.tsx:43:9: `list`: setup-local value is not proved serializable at the candidate root edge.

### Named U sources

- examples/effect-yield/src/typeahead.tsx:102:19: `() => runEffect(searchPackages(q))` — attempt target not proved a server function; 25 client parts.
- examples/effect-yield/src/typeahead.tsx:103:13: `runEffect` — unanalysed call; 25 client parts.
- examples/effect-yield/src/typeahead.tsx:103:23: `searchPackages` — unanalysed call; 25 client parts.
- examples/effect-yield/src/typeahead.tsx:100:15: `(yield* query).trim` — unanalysed call; 25 client parts.
- examples/effect-yield/src/typeahead.tsx:133:22: `(yield* query).trim` — unanalysed call; 24 client parts.
- examples/effect-yield/src/checkout.tsx:127:19: `() => fetchOrders()` — attempt target not proved a server function; 19 client parts.
- examples/effect-yield/src/checkout.tsx:128:13: `fetchOrders` — unanalysed call; 19 client parts.
- examples/effect-yield/src/app.tsx:27:12: `[...(yield* entries)].reverse` — unanalysed call; 13 client parts.
- examples/effect-yield/src/app.tsx:30:12: `yield* props.log.clear` — unanalysed call; 6 client parts.
- examples/effect-yield/src/app.tsx:94:43: `String` — unanalysed call; 2 client parts.
- examples/effect-yield/src/app.tsx:94:50: `err` — unanalysed call; 2 client parts.
- examples/effect-yield/src/app.tsx:92:29: `reset` — unresolved parameter (row, callback or foreign props); 2 client parts.
- examples/effect-yield/src/app.tsx:100:17: `RuntimeContext` — foreign tag; 3 client parts.
- examples/effect-yield/src/app.tsx:79:19: `createRuntime` — unanalysed call; 3 client parts.
- examples/effect-yield/src/api.ts:71:33: `Layer.succeed` — unanalysed call; 3 client parts.
- examples/effect-yield/src/api.ts:66:8: `class SearchConfig extends Context.Tag("SearchConfig")<SearchConfig, {   readonly flakiness: number;` — unread import or mutable binding; 3 client parts.
- examples/effect-yield/src/checkout.tsx:123:53: `INITIAL_CART.map` — unanalysed call; 25 client parts.
- examples/effect-yield/src/checkout.tsx:123:70: `i` — unresolved parameter (row, callback or foreign props); 25 client parts.
- examples/effect-yield/src/checkout.tsx:142:7: `c.reduce` — unanalysed call; 11 client parts.
- examples/effect-yield/src/checkout.tsx:142:17: `sum` — unresolved parameter (row, callback or foreign props); 11 client parts.
- examples/effect-yield/src/checkout.tsx:142:22: `item` — unresolved parameter (row, callback or foreign props); 11 client parts.
- examples/effect-yield/src/checkout.tsx:152:28: `reserveInventory` — unanalysed call; 6 client parts.
- examples/effect-yield/src/checkout.tsx:146:46: `items` — unresolved parameter (row, callback or foreign props); 6 client parts.
- examples/effect-yield/src/checkout.tsx:154:23: `chargeCard` — unanalysed call; 6 client parts.
- examples/effect-yield/src/checkout.tsx:155:9: `items.reduce` — unanalysed call; 6 client parts.
- examples/effect-yield/src/checkout.tsx:155:23: `sum` — unresolved parameter (row, callback or foreign props); 6 client parts.
- examples/effect-yield/src/checkout.tsx:155:28: `item` — unresolved parameter (row, callback or foreign props); 6 client parts.
- examples/effect-yield/src/checkout.tsx:146:65: `decline` — unresolved parameter (row, callback or foreign props); 6 client parts.
- examples/effect-yield/src/checkout.tsx:159:28: `createOrder` — unanalysed call; 6 client parts.
- examples/effect-yield/src/checkout.tsx:147:9: `reservation: Reservation | undefined` — unread import or mutable binding; 6 client parts.
- examples/effect-yield/src/checkout.tsx:148:9: `charge: Charge | undefined` — unread import or mutable binding; 6 client parts.
- examples/effect-yield/src/checkout.tsx:170:26: `refundCharge` — unanalysed call; 6 client parts.
- examples/effect-yield/src/checkout.tsx:171:31: `releaseReservation` — unanalysed call; 6 client parts.
- examples/effect-yield/src/checkout.tsx:191:47: `c.map` — unanalysed call; 10 client parts.
- examples/effect-yield/src/checkout.tsx:194:12: `() => placeOrder(items, decline)` — attempt target not proved a server function; 10 client parts.
- examples/effect-yield/src/checkout.tsx:195:13: `placeOrder` — unanalysed call; 10 client parts.
- examples/effect-yield/src/checkout.tsx:252:27: `((yield* item.price) * (yield* item.quantity)).toFixed` — unanalysed call; 8 client parts.
- examples/effect-yield/src/checkout.tsx:262:40: `(yield* total).toFixed` — unanalysed call; 6 client parts.
- examples/effect-yield/src/checkout.tsx:277:37: `(yield* total).toFixed` — unanalysed call; 8 client parts.
- examples/effect-yield/src/checkout.tsx:97:58: `(yield* order.total).toFixed` — unanalysed call; 15 client parts.
- examples/effect-yield/src/typeahead.tsx:146:63: `String` — unanalysed call; 10 client parts.
- examples/effect-yield/src/typeahead.tsx:146:70: `err` — unanalysed call; 10 client parts.
- examples/effect-yield/src/typeahead.tsx:75:34: `formatDownloads` — unanalysed call; 17 client parts.
- examples/effect-yield/src/solid-effect.ts:170:23: `advance` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:170:37: `it.next` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:177:48: `() => Effect.runPromise(Fiber.await(fiber))` — attempt target not proved a server function; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:178:15: `Effect.runPromise` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:178:33: `Fiber.await` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:174:21: `fork` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:174:26: `yieldWrapGet` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:182:47: `advance` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:182:61: `it.next` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:184:23: `advance` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:184:37: `it.throw` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:185:26: `advance` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:185:40: `it.throw` — unanalysed call; 1 client parts.
- examples/effect-yield/src/solid-effect.ts:185:49: `Cause.squash` — unanalysed call; 1 client parts.

### Setup findings

- examples/effect-yield/src/app.tsx:79:19: setup call createRuntime is not proved inert; eager fallback required.
- examples/effect-yield/src/checkout.tsx:146:22: setup call effectAction is not proved inert; eager fallback required.

## hackernews-spa-yield

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: visible, 16 parts; span unresolved; components Stories; sites examples/hackernews-spa-yield/src/app.tsx:23:18, examples/hackernews-spa-yield/src/routes/stories.tsx:24:23, examples/hackernews-spa-yield/src/routes/stories.tsx:27:26, examples/hackernews-spa-yield/src/routes/stories.tsx:40:11, examples/hackernews-spa-yield/src/routes/stories.tsx:40:18, examples/hackernews-spa-yield/src/routes/stories.tsx:49:23, examples/hackernews-spa-yield/src/routes/stories.tsx:49:30, examples/hackernews-spa-yield/src/routes/stories.tsx:64:41, examples/hackernews-spa-yield/src/routes/stories.tsx:75:23, examples/hackernews-spa-yield/src/routes/stories.tsx:75:30, examples/hackernews-spa-yield/src/routes/stories.tsx:77:35, examples/hackernews-spa-yield/src/routes/stories.tsx:77:55, examples/hackernews-spa-yield/src/routes/stories.tsx:90:41, examples/hackernews-spa-yield/src/routes/stories.tsx:102:23, examples/hackernews-spa-yield/src/routes/stories.tsx:102:30, examples/hackernews-spa-yield/src/routes/stories.tsx:106:39.
- Root 2: visible, 33 parts; span unresolved; components Story, Toggle, Comment; sites examples/hackernews-spa-yield/src/app.tsx:26:52, examples/hackernews-spa-yield/src/routes/story.tsx:16:24, examples/hackernews-spa-yield/src/components/toggle.tsx:6:34, examples/hackernews-spa-yield/src/components/toggle.tsx:7:18, examples/hackernews-spa-yield/src/routes/story.tsx:27:11, examples/hackernews-spa-yield/src/routes/story.tsx:27:18, examples/hackernews-spa-yield/src/routes/story.tsx:35:31, examples/hackernews-spa-yield/src/routes/story.tsx:36:29, examples/hackernews-spa-yield/src/routes/story.tsx:39:23, examples/hackernews-spa-yield/src/routes/story.tsx:39:30, examples/hackernews-spa-yield/src/routes/story.tsx:41:35, examples/hackernews-spa-yield/src/routes/story.tsx:44:56, examples/hackernews-spa-yield/src/routes/story.tsx:49:25, examples/hackernews-spa-yield/src/routes/story.tsx:50:43, examples/hackernews-spa-yield/src/routes/story.tsx:50:67, examples/hackernews-spa-yield/src/routes/story.tsx:51:25, examples/hackernews-spa-yield/src/routes/story.tsx:56:25, examples/hackernews-spa-yield/src/routes/story.tsx:57:28, examples/hackernews-spa-yield/src/routes/story.tsx:62:25, examples/hackernews-spa-yield/src/routes/story.tsx:62:32, examples/hackernews-spa-yield/src/routes/story.tsx:64:37, examples/hackernews-spa-yield/src/routes/story.tsx:68:41, examples/hackernews-spa-yield/src/components/comment.tsx:20:11, examples/hackernews-spa-yield/src/components/comment.tsx:20:18, examples/hackernews-spa-yield/src/components/comment.tsx:26:21, examples/hackernews-spa-yield/src/components/comment.tsx:31:31, examples/hackernews-spa-yield/src/components/comment.tsx:31:38, examples/hackernews-spa-yield/src/components/comment.tsx:35:47, examples/hackernews-spa-yield/src/components/toggle.tsx:13:40, examples/hackernews-spa-yield/src/components/toggle.tsx:14:23, examples/hackernews-spa-yield/src/components/toggle.tsx:14:40, examples/hackernews-spa-yield/src/components/toggle.tsx:16:57, examples/hackernews-spa-yield/src/components/toggle.tsx:17:12.
- Root 3: visible, 13 parts; span unresolved; components User; sites examples/hackernews-spa-yield/src/app.tsx:27:50, examples/hackernews-spa-yield/src/routes/user.tsx:13:23, examples/hackernews-spa-yield/src/routes/user.tsx:24:11, examples/hackernews-spa-yield/src/routes/user.tsx:24:18, examples/hackernews-spa-yield/src/routes/user.tsx:31:32, examples/hackernews-spa-yield/src/routes/user.tsx:34:61, examples/hackernews-spa-yield/src/routes/user.tsx:37:59, examples/hackernews-spa-yield/src/routes/user.tsx:40:23, examples/hackernews-spa-yield/src/routes/user.tsx:40:30, examples/hackernews-spa-yield/src/routes/user.tsx:42:35, examples/hackernews-spa-yield/src/routes/user.tsx:45:50, examples/hackernews-spa-yield/src/routes/user.tsx:51:76, examples/hackernews-spa-yield/src/routes/user.tsx:55:74.
- Root 4: lazy, 1 parts; span examples/hackernews-spa-yield/src/app.tsx:36:7; components App; sites examples/hackernews-spa-yield/src/app.tsx:36:7.

### Additional safety merges


### Capture candidates


### Named U sources

- examples/hackernews-spa-yield/src/routes/stories.tsx:25:12: `storyType` — unanalysed call; 16 client parts.
- examples/hackernews-spa-yield/src/routes/stories.tsx:30:19: `() => getStories(type2, page2)` — attempt target not proved a server function; 11 client parts.
- examples/hackernews-spa-yield/src/routes/stories.tsx:31:13: `getStories` — unanalysed call; 11 client parts.
- examples/hackernews-spa-yield/src/routes/story.tsx:18:19: `() => getStory(id2)` — attempt target not proved a server function; 20 client parts.
- examples/hackernews-spa-yield/src/routes/story.tsx:19:13: `getStory` — unanalysed call; 20 client parts.
- examples/hackernews-spa-yield/src/app.tsx:36:7: `Router` — foreign tag; 1 client parts.
- examples/hackernews-spa-yield/src/app.tsx:37:10: `props` — unresolved parameter (row, callback or foreign props); 1 client parts.
- examples/hackernews-spa-yield/src/routes/user.tsx:15:19: `() => getUser(id2)` — attempt target not proved a server function; 13 client parts.
- examples/hackernews-spa-yield/src/routes/user.tsx:16:13: `getUser` — unanalysed call; 13 client parts.
- examples/hackernews-spa-yield/src/app.tsx:23:18: `foreign` — unanalysed call; 1 client parts.
- examples/hackernews-spa-yield/src/app.tsx:26:52: `foreign` — unanalysed call; 1 client parts.
- examples/hackernews-spa-yield/src/app.tsx:27:50: `foreign` — unanalysed call; 1 client parts.

### Setup findings


## rendering-yield

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: visible, 58 parts; span unresolved; components component@examples/rendering-yield/shared/src/router.tsx:37:10, Link, component@examples/rendering-yield/shared/src/components/Profile/index.tsx:8:16, component@examples/rendering-yield/shared/src/components/App.tsx:28:3; sites examples/rendering-yield/shared/src/router.tsx:41:45, examples/rendering-yield/shared/src/router.tsx:42:29, examples/rendering-yield/shared/src/router.tsx:50:27, examples/rendering-yield/shared/src/router.tsx:91:20, examples/rendering-yield/shared/src/components/Profile/index.tsx:9:23, examples/rendering-yield/shared/src/components/Profile/index.tsx:21:23, examples/rendering-yield/csr/client.tsx:8:14, examples/rendering-yield/shared/src/components/App.tsx:36:36, examples/rendering-yield/shared/src/components/App.tsx:38:17, examples/rendering-yield/shared/src/components/App.tsx:46:36, examples/rendering-yield/shared/src/components/App.tsx:48:17, examples/rendering-yield/shared/src/components/App.tsx:56:36, examples/rendering-yield/shared/src/components/App.tsx:58:17, examples/rendering-yield/shared/src/components/App.tsx:66:36, examples/rendering-yield/shared/src/components/App.tsx:68:17, examples/rendering-yield/shared/src/components/App.tsx:76:36, examples/rendering-yield/shared/src/components/App.tsx:78:17, examples/rendering-yield/shared/src/components/App.tsx:86:36, examples/rendering-yield/shared/src/components/App.tsx:88:17, examples/rendering-yield/shared/src/components/App.tsx:96:36, examples/rendering-yield/shared/src/components/App.tsx:98:17, examples/rendering-yield/shared/src/components/App.tsx:107:42, examples/rendering-yield/shared/src/components/App.tsx:109:15, examples/rendering-yield/shared/src/components/App.tsx:109:22, examples/rendering-yield/shared/src/components/App.tsx:114:25, examples/rendering-yield/shared/src/components/App.tsx:114:32, examples/rendering-yield/shared/src/components/App.tsx:116:36, examples/rendering-yield/shared/src/components/App.tsx:119:39, examples/rendering-yield/shared/src/components/App.tsx:124:25, examples/rendering-yield/shared/src/components/App.tsx:124:32, examples/rendering-yield/shared/src/components/App.tsx:126:36, examples/rendering-yield/shared/src/components/App.tsx:129:39, examples/rendering-yield/shared/src/components/App.tsx:134:25, examples/rendering-yield/shared/src/components/App.tsx:134:32, examples/rendering-yield/shared/src/components/App.tsx:136:36, examples/rendering-yield/shared/src/components/App.tsx:139:39, examples/rendering-yield/shared/src/components/App.tsx:144:25, examples/rendering-yield/shared/src/components/App.tsx:144:32, examples/rendering-yield/shared/src/components/App.tsx:146:36, examples/rendering-yield/shared/src/components/App.tsx:149:39, examples/rendering-yield/shared/src/components/App.tsx:154:25, examples/rendering-yield/shared/src/components/App.tsx:154:32, examples/rendering-yield/shared/src/components/App.tsx:156:36, examples/rendering-yield/shared/src/components/App.tsx:159:39, examples/rendering-yield/shared/src/components/App.tsx:164:25, examples/rendering-yield/shared/src/components/App.tsx:164:32, examples/rendering-yield/shared/src/components/App.tsx:166:36, examples/rendering-yield/shared/src/components/App.tsx:169:39, examples/rendering-yield/shared/src/components/App.tsx:174:25, examples/rendering-yield/shared/src/components/App.tsx:174:32, examples/rendering-yield/shared/src/components/App.tsx:176:36, examples/rendering-yield/shared/src/components/App.tsx:179:39, examples/rendering-yield/shared/src/router.tsx:59:13, examples/rendering-yield/shared/src/router.tsx:62:27, examples/rendering-yield/shared/src/router.tsx:79:18, examples/rendering-yield/shared/src/router.tsx:99:63, examples/rendering-yield/shared/src/components/Profile/index.tsx:45:15, examples/rendering-yield/shared/src/router.tsx:59:20.
- Root 2: eager, 4 parts; span examples/rendering-yield/shared/src/components/Home.tsx:25:9; components Home; sites examples/rendering-yield/shared/src/components/Home.tsx:4:27, examples/rendering-yield/shared/src/components/Home.tsx:9:16, examples/rendering-yield/shared/src/components/Home.tsx:12:10, examples/rendering-yield/shared/src/components/Home.tsx:25:16.
  - Effect examples/rendering-yield/shared/src/components/Home.tsx:12:10; touched: examples/rendering-yield/shared/src/components/Home.tsx:9:16, examples/rendering-yield/shared/src/components/Home.tsx:4:27; pulled in: examples/rendering-yield/shared/src/components/Home.tsx:25:16.
- Root 3: eager, 16 parts; span examples/rendering-yield/shared/src/components/Settings.tsx:29:7; components Settings; sites examples/rendering-yield/shared/src/components/Settings.tsx:8:34, examples/rendering-yield/shared/src/components/Settings.tsx:9:44, examples/rendering-yield/shared/src/components/Settings.tsx:10:48, examples/rendering-yield/shared/src/components/Settings.tsx:14:17, examples/rendering-yield/shared/src/components/Settings.tsx:17:17, examples/rendering-yield/shared/src/components/Settings.tsx:20:16, examples/rendering-yield/shared/src/components/Settings.tsx:23:17, examples/rendering-yield/shared/src/components/Settings.tsx:40:11, examples/rendering-yield/shared/src/components/Settings.tsx:29:25, examples/rendering-yield/shared/src/components/Settings.tsx:33:43, examples/rendering-yield/shared/src/components/Settings.tsx:33:65, examples/rendering-yield/shared/src/components/Settings.tsx:34:13, examples/rendering-yield/shared/src/components/Settings.tsx:35:40, examples/rendering-yield/shared/src/components/Settings.tsx:38:36, examples/rendering-yield/shared/src/components/Settings.tsx:39:11, examples/rendering-yield/shared/src/components/Settings.tsx:45:48. Fallback: unproved setup work.
- Root 4: visible, 16 parts; span examples/rendering-yield/shared/src/components/Stream.tsx:133:9; components Stream, MemoList, ProjList; sites examples/rendering-yield/shared/src/components/Stream.tsx:101:28, examples/rendering-yield/shared/src/components/Stream.tsx:111:28, examples/rendering-yield/shared/src/components/Stream.tsx:53:11, examples/rendering-yield/shared/src/components/Stream.tsx:53:18, examples/rendering-yield/shared/src/components/Stream.tsx:59:22, examples/rendering-yield/shared/src/components/Stream.tsx:59:40, examples/rendering-yield/shared/src/components/Stream.tsx:78:11, examples/rendering-yield/shared/src/components/Stream.tsx:78:18, examples/rendering-yield/shared/src/components/Stream.tsx:87:40, examples/rendering-yield/shared/src/components/Stream.tsx:87:74, examples/rendering-yield/shared/src/components/Stream.tsx:138:15, examples/rendering-yield/shared/src/components/Stream.tsx:138:22, examples/rendering-yield/shared/src/components/Stream.tsx:143:29, examples/rendering-yield/shared/src/components/Stream.tsx:152:15, examples/rendering-yield/shared/src/components/Stream.tsx:152:22, examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- Root 5: visible, 15 parts; span examples/rendering-yield/shared/src/components/ErrorStream.tsx:148:7; components InnerBoundaryItem, OuterBoundaryItem, ErrorStream; sites examples/rendering-yield/shared/src/components/ErrorStream.tsx:43:23, examples/rendering-yield/shared/src/components/ErrorStream.tsx:89:11, examples/rendering-yield/shared/src/components/ErrorStream.tsx:89:18, examples/rendering-yield/shared/src/components/ErrorStream.tsx:97:21, examples/rendering-yield/shared/src/components/ErrorStream.tsx:97:28, examples/rendering-yield/shared/src/components/ErrorStream.tsx:100:35, examples/rendering-yield/shared/src/components/ErrorStream.tsx:120:11, examples/rendering-yield/shared/src/components/ErrorStream.tsx:120:18, examples/rendering-yield/shared/src/components/ErrorStream.tsx:126:21, examples/rendering-yield/shared/src/components/ErrorStream.tsx:126:28, examples/rendering-yield/shared/src/components/ErrorStream.tsx:131:35, examples/rendering-yield/shared/src/components/ErrorStream.tsx:156:12, examples/rendering-yield/shared/src/components/ErrorStream.tsx:157:12, examples/rendering-yield/shared/src/components/ErrorStream.tsx:161:12, examples/rendering-yield/shared/src/components/ErrorStream.tsx:162:12.
- Root 6: lazy, 2 parts; span examples/rendering-yield/shared/src/components/ErrorStream.tsx:74:11; components unresolved; sites examples/rendering-yield/shared/src/components/ErrorStream.tsx:66:19, examples/rendering-yield/shared/src/components/ErrorStream.tsx:74:28.
- Root 7: visible, 43 parts; span examples/rendering-yield/shared/src/components/Reveal.tsx:102:7; components AsyncCard, RevealPage, CardBody; sites examples/rendering-yield/shared/src/components/Reveal.tsx:42:24, examples/rendering-yield/shared/src/components/Reveal.tsx:85:36, examples/rendering-yield/shared/src/components/Reveal.tsx:86:44, examples/rendering-yield/shared/src/components/Reveal.tsx:87:34, examples/rendering-yield/shared/src/components/Reveal.tsx:90:5, examples/rendering-yield/shared/src/components/Reveal.tsx:93:20, examples/rendering-yield/shared/src/components/Reveal.tsx:96:19, examples/rendering-yield/shared/src/components/Reveal.tsx:178:19, examples/rendering-yield/shared/src/components/Reveal.tsx:193:19, examples/rendering-yield/shared/src/components/Reveal.tsx:196:23, examples/rendering-yield/shared/src/components/Reveal.tsx:26:18, examples/rendering-yield/shared/src/components/Reveal.tsx:27:15, examples/rendering-yield/shared/src/components/Reveal.tsx:57:11, examples/rendering-yield/shared/src/components/Reveal.tsx:57:18, examples/rendering-yield/shared/src/components/Reveal.tsx:65:21, examples/rendering-yield/shared/src/components/Reveal.tsx:65:28, examples/rendering-yield/shared/src/components/Reveal.tsx:68:35, examples/rendering-yield/shared/src/components/Reveal.tsx:110:34, examples/rendering-yield/shared/src/components/Reveal.tsx:128:27, examples/rendering-yield/shared/src/components/Reveal.tsx:129:26, examples/rendering-yield/shared/src/components/Reveal.tsx:138:27, examples/rendering-yield/shared/src/components/Reveal.tsx:139:26, examples/rendering-yield/shared/src/components/Reveal.tsx:148:27, examples/rendering-yield/shared/src/components/Reveal.tsx:149:26, examples/rendering-yield/shared/src/components/Reveal.tsx:157:24, examples/rendering-yield/shared/src/components/Reveal.tsx:158:26, examples/rendering-yield/shared/src/components/Reveal.tsx:159:24, examples/rendering-yield/shared/src/components/Reveal.tsx:163:28, examples/rendering-yield/shared/src/components/Reveal.tsx:167:11, examples/rendering-yield/shared/src/components/Reveal.tsx:167:18, examples/rendering-yield/shared/src/components/Reveal.tsx:175:76, examples/rendering-yield/shared/src/components/Reveal.tsx:178:34, examples/rendering-yield/shared/src/components/Reveal.tsx:178:59, examples/rendering-yield/shared/src/components/Reveal.tsx:180:24, examples/rendering-yield/shared/src/components/Reveal.tsx:181:24, examples/rendering-yield/shared/src/components/Reveal.tsx:182:24, examples/rendering-yield/shared/src/components/Reveal.tsx:188:56, examples/rendering-yield/shared/src/components/Reveal.tsx:193:34, examples/rendering-yield/shared/src/components/Reveal.tsx:193:59, examples/rendering-yield/shared/src/components/Reveal.tsx:195:24, examples/rendering-yield/shared/src/components/Reveal.tsx:198:28, examples/rendering-yield/shared/src/components/Reveal.tsx:199:28, examples/rendering-yield/shared/src/components/Reveal.tsx:202:24.
- Root 8: visible, 9 parts; span examples/rendering-yield/shared/src/components/Skeleton.tsx:127:7; components Skeleton; sites examples/rendering-yield/shared/src/components/Skeleton.tsx:88:40, examples/rendering-yield/shared/src/components/Skeleton.tsx:92:23, examples/rendering-yield/shared/src/components/Skeleton.tsx:105:24, examples/rendering-yield/shared/src/components/Skeleton.tsx:121:19, examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44, examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67, examples/rendering-yield/shared/src/components/Skeleton.tsx:142:14, examples/rendering-yield/shared/src/components/Skeleton.tsx:146:14, examples/rendering-yield/shared/src/components/Skeleton.tsx:149:40.
- Root 9: lazy, 8 parts; span examples/rendering-yield/shared/src/components/Profile/Profile.tsx:50:7; components Facts, Profile; sites examples/rendering-yield/shared/src/components/Profile/Profile.tsx:27:11, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:27:18, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:31:29, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:54:11, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:54:18, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:60:21, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:60:28, examples/rendering-yield/shared/src/components/Profile/Profile.tsx:65:35.
- Root 10: lazy, 1 parts; span examples/rendering-yield/shared/src/components/ErrorStream.tsx:73:11; components unresolved; sites examples/rendering-yield/shared/src/components/ErrorStream.tsx:73:35.

### Additional safety merges

- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:36:36 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:38:17 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:46:36 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:48:17 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:56:36 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:58:17 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:66:36 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:68:17 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:76:36 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:78:17 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:86:36 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:88:17 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:96:36 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:98:17 ↔ examples/rendering-yield/shared/src/components/App.tsx:107:42.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:109:15.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:109:22.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:114:25.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:114:32.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:116:36.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:119:39.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:124:25.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:124:32.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:126:36.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:129:39.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:134:25.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:134:32.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:136:36.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:139:39.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:144:25.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:144:32.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:146:36.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:149:39.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:154:25.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:154:32.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:156:36.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:159:39.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:164:25.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:164:32.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:166:36.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:169:39.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:174:25.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:174:32.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:176:36.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/App.tsx:107:42 ↔ examples/rendering-yield/shared/src/components/App.tsx:179:39.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:101:28 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:15.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:111:28 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:15.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:138:15 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:15.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:138:22 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:15.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:143:29 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:15.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:152:15 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:22.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:152:15 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:101:28 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:22.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:111:28 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:22.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:138:15 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:22.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:138:22 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:22.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:143:29 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:152:22.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:152:22 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:101:28 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:111:28 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:138:15 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:138:22 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Stream.tsx:143:29 ↔ examples/rendering-yield/shared/src/components/Stream.tsx:157:29.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:85:36 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:86:44 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:87:34 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:90:5 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:93:20 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:96:19 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:19.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:19.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:196:23.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:110:34 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:128:27 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:129:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:138:27.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:148:27.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:157:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:158:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:159:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:163:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:167:11.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:167:18.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:175:76.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:34.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:59.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:180:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:181:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:182:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:188:56.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:34.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:59.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:195:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:198:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:199:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:129:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:202:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:85:36 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:86:44 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:87:34 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:90:5 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:93:20 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:96:19 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:19.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:19.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:196:23.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:110:34 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:128:27 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:138:27 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:139:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:148:27.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:157:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:158:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:159:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:163:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:167:11.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:167:18.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:175:76.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:34.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:59.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:180:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:181:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:182:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:188:56.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:34.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:59.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:195:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:198:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:199:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:139:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:202:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:85:36 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:86:44 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:87:34 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:90:5 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:93:20 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:96:19 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:19.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:19.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:196:23.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:110:34 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:128:27 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:138:27 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:148:27 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:149:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:157:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:158:26.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:159:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:163:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:167:11.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:167:18.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:175:76.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:34.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:178:59.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:180:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:181:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:182:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:188:56.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:34.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:193:59.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:195:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:198:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:199:28.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Reveal.tsx:149:26 ↔ examples/rendering-yield/shared/src/components/Reveal.tsx:202:24.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:88:40 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:92:23 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:105:24 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:121:19 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:142:14.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:146:14.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:127:44 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:149:40.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:88:40 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:92:23 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:105:24 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:121:19 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:142:14.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:146:14.
- CAPTURE_FALLBACK: examples/rendering-yield/shared/src/components/Skeleton.tsx:127:67 ↔ examples/rendering-yield/shared/src/components/Skeleton.tsx:149:40.
- SPAN_OVERLAP: examples/rendering-yield/shared/src/components/Settings.tsx:8:34 ↔ examples/rendering-yield/shared/src/components/Settings.tsx:9:44.

### Capture candidates

- examples/rendering-yield/shared/src/components/App.tsx:30:11: `pending`: setup-local value is not proved serializable at the candidate root edge.
- examples/rendering-yield/shared/src/components/Stream.tsx:123:9: `count`: setup-local value is not proved serializable at the candidate root edge.
- examples/rendering-yield/shared/src/components/Reveal.tsx:89:9: `pick`: setup-local value is not proved serializable at the candidate root edge.
- examples/rendering-yield/shared/src/components/Skeleton.tsx:119:9: `refreshing`: setup-local value is not proved serializable at the candidate root edge.
- examples/rendering-yield/shared/src/components/Skeleton.tsx:120:9: `storeRefreshing`: setup-local value is not proved serializable at the candidate root edge.

### Named U sources

- examples/rendering-yield/shared/src/components/Stream.tsx:102:19: `() => accumulate()` — attempt target not proved a server function; 8 client parts.
- examples/rendering-yield/shared/src/components/Stream.tsx:112:19: `() => async function* () {   for await (const val of getData()) {     state.push(val);     yield;   ` — attempt target not proved a server function; 8 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:41:16: `props` — unresolved parameter (row, callback or foreign props); 15 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:45:19: `() => loadItem(current)` — attempt target not proved a server function; 15 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:46:13: `loadItem` — unanalysed call; 15 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:45:19: `() => delayedValue(delay, '${title} resolved in ${delay}ms')` — attempt target not proved a server function; 20 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:46:13: `delayedValue` — unanalysed call; 20 client parts.
- examples/rendering-yield/shared/src/components/Skeleton.tsx:95:21: `() => fetchFeed()` — attempt target not proved a server function; 3 client parts.
- examples/rendering-yield/shared/src/components/Skeleton.tsx:96:15: `fetchFeed` — unanalysed call; 3 client parts.
- examples/rendering-yield/shared/src/components/Skeleton.tsx:100:21: `placeholderFeed` — unanalysed call; 3 client parts.
- examples/rendering-yield/shared/src/components/Skeleton.tsx:108:27: `() => fetchFeed()` — attempt target not proved a server function; 3 client parts.
- examples/rendering-yield/shared/src/components/Skeleton.tsx:109:15: `fetchFeed` — unanalysed call; 3 client parts.
- examples/rendering-yield/shared/src/router.tsx:83:14: `match` — unresolved parameter (row, callback or foreign props); 11 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:36:43: `matches` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/router.tsx:95:12: `yield* setLocation` — unanalysed call; 10 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:46:43: `matches` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:56:43: `matches` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:66:43: `matches` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:76:43: `matches` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:86:43: `matches` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:96:43: `matches` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:116:43: `matches` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:119:46: `Home` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:126:43: `matches` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/Profile/index.tsx:12:19: `() => new Promise<User>(resolve => {   setTimeout(() => resolve({     firstName: "Jon",     lastName` — attempt target not proved a server function; 9 client parts.
- examples/rendering-yield/shared/src/components/Profile/index.tsx:25:19: `() => new Promise<string[]>(resolve => {   setTimeout(() => resolve(["Something Interesting", "Somet` — attempt target not proved a server function; 8 client parts.
- examples/rendering-yield/shared/src/components/Profile/index.tsx:45:22: `Profile` — unanalysed call; 7 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:136:43: `matches` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:139:46: `Settings` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:146:43: `matches` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:149:46: `Stream` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:156:43: `matches` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:159:46: `ErrorStream` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:166:43: `matches` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:169:46: `RevealPage` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:176:43: `matches` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:179:46: `Skeleton` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/router.tsx:62:34: `Comp` — unanalysed call; 3 client parts.
- examples/rendering-yield/shared/src/components/Home.tsx:16:29: `clearInterval` — unanalysed call; 1 client parts.
- examples/rendering-yield/shared/src/components/Home.tsx:15:17: `setInterval` — unanalysed call; 1 client parts.
- examples/rendering-yield/shared/src/components/Settings.tsx:11:14: `createUniqueId` — unanalysed call; 0 client parts.
- examples/rendering-yield/shared/src/components/Settings.tsx:40:11: `Portal` — foreign tag; 1 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:98:33: `fallback` — unanalysed call; 6 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:121:23: `fallback` — unanalysed call; 4 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:89:17: `value` — unresolved parameter (row, callback or foreign props); 1 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:129:33: `pick` — unanalysed call; 1 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:139:33: `pick` — unanalysed call; 1 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:149:33: `pick` — unanalysed call; 1 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:178:19: `Reveal` — foreign tag; 3 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:193:19: `Reveal` — foreign tag; 3 client parts.
- examples/rendering-yield/shared/src/components/Reveal.tsx:196:23: `Reveal` — foreign tag; 4 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:67:14: `setId` — unanalysed call; 2 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:65:21: `error` — unresolved parameter (row, callback or foreign props); 1 client parts.
- examples/rendering-yield/shared/src/components/App.tsx:27:13: `RouteHOC` — unanalysed call; 1 client parts.
- examples/rendering-yield/shared/src/components/ErrorStream.tsx:73:28: `String` — unanalysed call; 0 client parts.

### Setup findings

- examples/rendering-yield/shared/src/components/Settings.tsx:11:14: setup call createUniqueId is not proved inert; eager fallback required.

## room-yield

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: eager, 122 parts; span unresolved; components App, IdentityProvider, Live, Header, Chaos, Chat, Composer, DirectoryEntry, Card, ActivityLine, Summary, SummaryText, Archive, LivePage, Joined, Transcript, Messages, Directory, CardBody, StatusPill; sites examples/room-yield/src/app.tsx:20:17, examples/room-yield/src/lib/identity.tsx:54:30, examples/room-yield/src/lib/identity.tsx:55:10, examples/room-yield/src/routes.ts:18:50, examples/room-yield/src/routes/live.tsx:65:23, examples/room-yield/src/routes/live.tsx:117:22, examples/room-yield/src/routes/live.tsx:126:25, examples/room-yield/src/routes/live.tsx:222:34, examples/room-yield/src/routes/live.tsx:223:16, examples/room-yield/src/routes/live.tsx:266:41, examples/room-yield/src/routes/live.tsx:276:40, examples/room-yield/src/routes/live.tsx:277:36, examples/room-yield/src/routes/live.tsx:278:16, examples/room-yield/src/routes/live.tsx:394:34, examples/room-yield/src/routes/live.tsx:396:18, examples/room-yield/src/routes/live.tsx:405:17, examples/room-yield/src/routes/live.tsx:479:22, examples/room-yield/src/routes/live.tsx:521:61, examples/room-yield/src/routes/live.tsx:528:26, examples/room-yield/src/routes/live.tsx:535:27, examples/room-yield/src/routes/live.tsx:629:24, examples/room-yield/src/routes/live.tsx:664:42, examples/room-yield/src/routes/live.tsx:665:22, examples/room-yield/src/routes/live.tsx:719:23, examples/room-yield/src/routes/live.tsx:740:24, examples/room-yield/src/components/status-pill.tsx:23:38, examples/room-yield/src/components/status-pill.tsx:24:38, examples/room-yield/src/components/status-pill.tsx:25:36, examples/room-yield/src/components/status-pill.tsx:27:18, examples/room-yield/src/app.tsx:17:11, examples/room-yield/src/lib/identity.tsx:65:11, examples/room-yield/src/lib/identity.tsx:68:25, examples/room-yield/src/lib/identity.tsx:79:10, examples/room-yield/src/routes/live.tsx:73:11, examples/room-yield/src/routes/live.tsx:73:18, examples/room-yield/src/routes/live.tsx:80:25, examples/room-yield/src/routes/live.tsx:94:10, examples/room-yield/src/routes/live.tsx:96:31, examples/room-yield/src/routes/live.tsx:98:14, examples/room-yield/src/routes/live.tsx:99:14, examples/room-yield/src/routes/live.tsx:100:14, examples/room-yield/src/routes/live.tsx:101:14, examples/room-yield/src/routes/live.tsx:134:17, examples/room-yield/src/routes/live.tsx:137:15, examples/room-yield/src/routes/live.tsx:137:22, examples/room-yield/src/routes/live.tsx:140:29, examples/room-yield/src/routes/live.tsx:149:13, examples/room-yield/src/routes/live.tsx:149:20, examples/room-yield/src/routes/live.tsx:154:27, examples/room-yield/src/routes/live.tsx:158:12, examples/room-yield/src/routes/live.tsx:159:12, examples/room-yield/src/routes/live.tsx:173:11, examples/room-yield/src/routes/live.tsx:173:18, examples/room-yield/src/routes/live.tsx:240:40, examples/room-yield/src/routes/live.tsx:244:11, examples/room-yield/src/routes/live.tsx:244:18, examples/room-yield/src/routes/live.tsx:247:44, examples/room-yield/src/routes/live.tsx:311:10, examples/room-yield/src/routes/live.tsx:312:10, examples/room-yield/src/routes/live.tsx:328:12, examples/room-yield/src/routes/live.tsx:331:11, examples/room-yield/src/routes/live.tsx:331:18, examples/room-yield/src/routes/live.tsx:336:25, examples/room-yield/src/routes/live.tsx:353:11, examples/room-yield/src/routes/live.tsx:353:18, examples/room-yield/src/routes/live.tsx:360:32, examples/room-yield/src/routes/live.tsx:361:30, examples/room-yield/src/routes/live.tsx:361:50, examples/room-yield/src/routes/live.tsx:362:35, examples/room-yield/src/routes/live.tsx:365:41, examples/room-yield/src/routes/live.tsx:366:41, examples/room-yield/src/routes/live.tsx:367:51, examples/room-yield/src/routes/live.tsx:410:40, examples/room-yield/src/routes/live.tsx:412:18, examples/room-yield/src/routes/live.tsx:413:20, examples/room-yield/src/routes/live.tsx:414:36, examples/room-yield/src/routes/live.tsx:415:22, examples/room-yield/src/routes/live.tsx:418:42, examples/room-yield/src/routes/live.tsx:422:11, examples/room-yield/src/routes/live.tsx:422:18, examples/room-yield/src/routes/live.tsx:430:11, examples/room-yield/src/routes/live.tsx:430:18, examples/room-yield/src/routes/live.tsx:435:20, examples/room-yield/src/routes/live.tsx:460:13, examples/room-yield/src/routes/live.tsx:460:20, examples/room-yield/src/routes/live.tsx:464:29, examples/room-yield/src/routes/live.tsx:488:19, examples/room-yield/src/routes/live.tsx:488:43, examples/room-yield/src/routes/live.tsx:489:32, examples/room-yield/src/routes/live.tsx:489:55, examples/room-yield/src/routes/live.tsx:492:13, examples/room-yield/src/routes/live.tsx:492:20, examples/room-yield/src/routes/live.tsx:495:27, examples/room-yield/src/routes/live.tsx:500:33, examples/room-yield/src/routes/live.tsx:500:62, examples/room-yield/src/routes/live.tsx:547:12, examples/room-yield/src/routes/live.tsx:550:11, examples/room-yield/src/routes/live.tsx:550:18, examples/room-yield/src/routes/live.tsx:556:25, examples/room-yield/src/routes/live.tsx:583:13, examples/room-yield/src/routes/live.tsx:583:20, examples/room-yield/src/routes/live.tsx:588:27, examples/room-yield/src/routes/live.tsx:595:13, examples/room-yield/src/routes/live.tsx:595:20, examples/room-yield/src/routes/live.tsx:600:27, examples/room-yield/src/routes/live.tsx:638:13, examples/room-yield/src/routes/live.tsx:638:20, examples/room-yield/src/routes/live.tsx:642:40, examples/room-yield/src/routes/live.tsx:677:11, examples/room-yield/src/routes/live.tsx:677:18, examples/room-yield/src/routes/live.tsx:685:51, examples/room-yield/src/routes/live.tsx:686:53, examples/room-yield/src/routes/live.tsx:697:21, examples/room-yield/src/routes/live.tsx:697:28, examples/room-yield/src/routes/live.tsx:702:35, examples/room-yield/src/routes/live.tsx:731:16, examples/room-yield/src/routes/live.tsx:755:11, examples/room-yield/src/routes/live.tsx:755:18, examples/room-yield/src/routes/live.tsx:761:25, examples/room-yield/src/components/status-pill.tsx:68:11, examples/room-yield/src/components/status-pill.tsx:68:36, examples/room-yield/src/lib/identity.tsx:65:18.
  - Effect examples/room-yield/src/lib/identity.tsx:55:10; touched: examples/room-yield/src/lib/identity.tsx:54:30; pulled in: examples/room-yield/src/app.tsx:20:17, examples/room-yield/src/routes.ts:18:50, examples/room-yield/src/routes/live.tsx:65:23, examples/room-yield/src/routes/live.tsx:117:22, examples/room-yield/src/routes/live.tsx:126:25, examples/room-yield/src/routes/live.tsx:222:34, examples/room-yield/src/routes/live.tsx:223:16, examples/room-yield/src/routes/live.tsx:266:41, examples/room-yield/src/routes/live.tsx:276:40, examples/room-yield/src/routes/live.tsx:277:36, examples/room-yield/src/routes/live.tsx:278:16, examples/room-yield/src/routes/live.tsx:394:34, examples/room-yield/src/routes/live.tsx:396:18, examples/room-yield/src/routes/live.tsx:405:17, examples/room-yield/src/routes/live.tsx:479:22, examples/room-yield/src/routes/live.tsx:521:61, examples/room-yield/src/routes/live.tsx:528:26, examples/room-yield/src/routes/live.tsx:535:27, examples/room-yield/src/routes/live.tsx:629:24, examples/room-yield/src/routes/live.tsx:664:42, examples/room-yield/src/routes/live.tsx:665:22, examples/room-yield/src/routes/live.tsx:719:23, examples/room-yield/src/routes/live.tsx:740:24, examples/room-yield/src/components/status-pill.tsx:23:38, examples/room-yield/src/components/status-pill.tsx:24:38, examples/room-yield/src/components/status-pill.tsx:25:36, examples/room-yield/src/components/status-pill.tsx:27:18, examples/room-yield/src/app.tsx:17:11, examples/room-yield/src/lib/identity.tsx:65:11, examples/room-yield/src/lib/identity.tsx:68:25, examples/room-yield/src/lib/identity.tsx:79:10, examples/room-yield/src/routes/live.tsx:73:11, examples/room-yield/src/routes/live.tsx:73:18, examples/room-yield/src/routes/live.tsx:80:25, examples/room-yield/src/routes/live.tsx:94:10, examples/room-yield/src/routes/live.tsx:96:31, examples/room-yield/src/routes/live.tsx:98:14, examples/room-yield/src/routes/live.tsx:99:14, examples/room-yield/src/routes/live.tsx:100:14, examples/room-yield/src/routes/live.tsx:101:14, examples/room-yield/src/routes/live.tsx:134:17, examples/room-yield/src/routes/live.tsx:137:15, examples/room-yield/src/routes/live.tsx:137:22, examples/room-yield/src/routes/live.tsx:140:29, examples/room-yield/src/routes/live.tsx:149:13, examples/room-yield/src/routes/live.tsx:149:20, examples/room-yield/src/routes/live.tsx:154:27, examples/room-yield/src/routes/live.tsx:158:12, examples/room-yield/src/routes/live.tsx:159:12, examples/room-yield/src/routes/live.tsx:173:11, examples/room-yield/src/routes/live.tsx:173:18, examples/room-yield/src/routes/live.tsx:240:40, examples/room-yield/src/routes/live.tsx:244:11, examples/room-yield/src/routes/live.tsx:244:18, examples/room-yield/src/routes/live.tsx:247:44, examples/room-yield/src/routes/live.tsx:311:10, examples/room-yield/src/routes/live.tsx:312:10, examples/room-yield/src/routes/live.tsx:328:12, examples/room-yield/src/routes/live.tsx:331:11, examples/room-yield/src/routes/live.tsx:331:18, examples/room-yield/src/routes/live.tsx:336:25, examples/room-yield/src/routes/live.tsx:353:11, examples/room-yield/src/routes/live.tsx:353:18, examples/room-yield/src/routes/live.tsx:360:32, examples/room-yield/src/routes/live.tsx:361:30, examples/room-yield/src/routes/live.tsx:361:50, examples/room-yield/src/routes/live.tsx:362:35, examples/room-yield/src/routes/live.tsx:365:41, examples/room-yield/src/routes/live.tsx:366:41, examples/room-yield/src/routes/live.tsx:367:51, examples/room-yield/src/routes/live.tsx:410:40, examples/room-yield/src/routes/live.tsx:412:18, examples/room-yield/src/routes/live.tsx:413:20, examples/room-yield/src/routes/live.tsx:414:36, examples/room-yield/src/routes/live.tsx:415:22, examples/room-yield/src/routes/live.tsx:418:42, examples/room-yield/src/routes/live.tsx:422:11, examples/room-yield/src/routes/live.tsx:422:18, examples/room-yield/src/routes/live.tsx:430:11, examples/room-yield/src/routes/live.tsx:430:18, examples/room-yield/src/routes/live.tsx:435:20, examples/room-yield/src/routes/live.tsx:460:13, examples/room-yield/src/routes/live.tsx:460:20, examples/room-yield/src/routes/live.tsx:464:29, examples/room-yield/src/routes/live.tsx:488:19, examples/room-yield/src/routes/live.tsx:488:43, examples/room-yield/src/routes/live.tsx:489:32, examples/room-yield/src/routes/live.tsx:489:55, examples/room-yield/src/routes/live.tsx:492:13, examples/room-yield/src/routes/live.tsx:492:20, examples/room-yield/src/routes/live.tsx:495:27, examples/room-yield/src/routes/live.tsx:500:33, examples/room-yield/src/routes/live.tsx:500:62, examples/room-yield/src/routes/live.tsx:547:12, examples/room-yield/src/routes/live.tsx:550:11, examples/room-yield/src/routes/live.tsx:550:18, examples/room-yield/src/routes/live.tsx:556:25, examples/room-yield/src/routes/live.tsx:583:13, examples/room-yield/src/routes/live.tsx:583:20, examples/room-yield/src/routes/live.tsx:588:27, examples/room-yield/src/routes/live.tsx:595:13, examples/room-yield/src/routes/live.tsx:595:20, examples/room-yield/src/routes/live.tsx:600:27, examples/room-yield/src/routes/live.tsx:638:13, examples/room-yield/src/routes/live.tsx:638:20, examples/room-yield/src/routes/live.tsx:642:40, examples/room-yield/src/routes/live.tsx:677:11, examples/room-yield/src/routes/live.tsx:677:18, examples/room-yield/src/routes/live.tsx:685:51, examples/room-yield/src/routes/live.tsx:686:53, examples/room-yield/src/routes/live.tsx:697:21, examples/room-yield/src/routes/live.tsx:697:28, examples/room-yield/src/routes/live.tsx:702:35, examples/room-yield/src/routes/live.tsx:731:16, examples/room-yield/src/routes/live.tsx:755:11, examples/room-yield/src/routes/live.tsx:755:18, examples/room-yield/src/routes/live.tsx:761:25, examples/room-yield/src/components/status-pill.tsx:68:11, examples/room-yield/src/components/status-pill.tsx:68:36, examples/room-yield/src/lib/identity.tsx:65:18.

### Additional safety merges

- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:126:25.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:134:17.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:137:15.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:137:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:140:29.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:149:13.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:149:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:117:22 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:134:17.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:137:15.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:137:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:140:29.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:149:13.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:149:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:126:25 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:266:41 ↔ examples/room-yield/src/routes/live.tsx:276:40.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:266:41 ↔ examples/room-yield/src/routes/live.tsx:277:36.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:266:41 ↔ examples/room-yield/src/routes/live.tsx:278:16.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:311:10 ↔ examples/room-yield/src/routes/live.tsx:266:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:312:10 ↔ examples/room-yield/src/routes/live.tsx:266:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:276:40 ↔ examples/room-yield/src/routes/live.tsx:278:16.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:277:36 ↔ examples/room-yield/src/routes/live.tsx:278:16.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:311:10 ↔ examples/room-yield/src/routes/live.tsx:278:16.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:312:10 ↔ examples/room-yield/src/routes/live.tsx:278:16.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:488:19.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:488:43.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:489:32.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:489:55.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:492:13.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:492:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:495:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:479:22 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:521:61 ↔ examples/room-yield/src/routes/live.tsx:528:26.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:521:61 ↔ examples/room-yield/src/routes/live.tsx:535:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:521:61 ↔ examples/room-yield/src/routes/live.tsx:547:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:521:61 ↔ examples/room-yield/src/routes/live.tsx:550:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:521:61 ↔ examples/room-yield/src/routes/live.tsx:550:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:521:61 ↔ examples/room-yield/src/routes/live.tsx:556:25.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:134:17 ↔ examples/room-yield/src/routes/live.tsx:137:15.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:15 ↔ examples/room-yield/src/routes/live.tsx:137:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:15 ↔ examples/room-yield/src/routes/live.tsx:140:29.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:15 ↔ examples/room-yield/src/routes/live.tsx:149:13.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:15 ↔ examples/room-yield/src/routes/live.tsx:149:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:15 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:15 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:15 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:134:17 ↔ examples/room-yield/src/routes/live.tsx:137:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:22 ↔ examples/room-yield/src/routes/live.tsx:140:29.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:22 ↔ examples/room-yield/src/routes/live.tsx:149:13.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:22 ↔ examples/room-yield/src/routes/live.tsx:149:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:22 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:22 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:137:22 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:134:17 ↔ examples/room-yield/src/routes/live.tsx:140:29.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:140:29 ↔ examples/room-yield/src/routes/live.tsx:149:13.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:140:29 ↔ examples/room-yield/src/routes/live.tsx:149:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:140:29 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:140:29 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:140:29 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:134:17 ↔ examples/room-yield/src/routes/live.tsx:149:13.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:149:13 ↔ examples/room-yield/src/routes/live.tsx:149:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:149:13 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:149:13 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:149:13 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:134:17 ↔ examples/room-yield/src/routes/live.tsx:149:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:149:20 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:149:20 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:149:20 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:134:17 ↔ examples/room-yield/src/routes/live.tsx:154:27.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:154:27 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:154:27 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:134:17 ↔ examples/room-yield/src/routes/live.tsx:158:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:158:12 ↔ examples/room-yield/src/routes/live.tsx:159:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:311:10 ↔ examples/room-yield/src/routes/live.tsx:276:40.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:311:10 ↔ examples/room-yield/src/routes/live.tsx:277:36.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:311:10 ↔ examples/room-yield/src/routes/live.tsx:312:10.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:353:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:360:32.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:361:30.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:361:50.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:362:35.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:365:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:366:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:11 ↔ examples/room-yield/src/routes/live.tsx:367:51.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:18 ↔ examples/room-yield/src/routes/live.tsx:360:32.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:18 ↔ examples/room-yield/src/routes/live.tsx:361:30.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:18 ↔ examples/room-yield/src/routes/live.tsx:361:50.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:18 ↔ examples/room-yield/src/routes/live.tsx:362:35.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:18 ↔ examples/room-yield/src/routes/live.tsx:365:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:18 ↔ examples/room-yield/src/routes/live.tsx:366:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:353:18 ↔ examples/room-yield/src/routes/live.tsx:367:51.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:360:32 ↔ examples/room-yield/src/routes/live.tsx:361:50.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:361:30 ↔ examples/room-yield/src/routes/live.tsx:361:50.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:361:50 ↔ examples/room-yield/src/routes/live.tsx:362:35.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:361:50 ↔ examples/room-yield/src/routes/live.tsx:365:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:361:50 ↔ examples/room-yield/src/routes/live.tsx:366:41.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:361:50 ↔ examples/room-yield/src/routes/live.tsx:367:51.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:394:34 ↔ examples/room-yield/src/routes/live.tsx:412:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:396:18 ↔ examples/room-yield/src/routes/live.tsx:412:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:405:17 ↔ examples/room-yield/src/routes/live.tsx:412:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:410:40 ↔ examples/room-yield/src/routes/live.tsx:412:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:413:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:414:36.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:415:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:422:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:422:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:430:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:430:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:412:18 ↔ examples/room-yield/src/routes/live.tsx:435:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:394:34 ↔ examples/room-yield/src/routes/live.tsx:415:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:396:18 ↔ examples/room-yield/src/routes/live.tsx:415:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:405:17 ↔ examples/room-yield/src/routes/live.tsx:415:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:410:40 ↔ examples/room-yield/src/routes/live.tsx:415:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:413:20 ↔ examples/room-yield/src/routes/live.tsx:415:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:414:36 ↔ examples/room-yield/src/routes/live.tsx:415:22.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:415:22 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:415:22 ↔ examples/room-yield/src/routes/live.tsx:422:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:415:22 ↔ examples/room-yield/src/routes/live.tsx:422:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:415:22 ↔ examples/room-yield/src/routes/live.tsx:430:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:415:22 ↔ examples/room-yield/src/routes/live.tsx:430:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:415:22 ↔ examples/room-yield/src/routes/live.tsx:435:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:394:34 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:396:18 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:405:17 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:410:40 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:413:20 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:414:36 ↔ examples/room-yield/src/routes/live.tsx:418:42.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:418:42 ↔ examples/room-yield/src/routes/live.tsx:422:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:418:42 ↔ examples/room-yield/src/routes/live.tsx:422:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:418:42 ↔ examples/room-yield/src/routes/live.tsx:430:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:418:42 ↔ examples/room-yield/src/routes/live.tsx:430:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:418:42 ↔ examples/room-yield/src/routes/live.tsx:435:20.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:488:19 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:488:43 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:489:32 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:489:55 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:492:13 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:492:20 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:495:27 ↔ examples/room-yield/src/routes/live.tsx:500:33.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:500:33 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:488:19 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:488:43 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:489:32 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:489:55 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:492:13 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:492:20 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:495:27 ↔ examples/room-yield/src/routes/live.tsx:500:62.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:528:26 ↔ examples/room-yield/src/routes/live.tsx:547:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:535:27 ↔ examples/room-yield/src/routes/live.tsx:547:12.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:547:12 ↔ examples/room-yield/src/routes/live.tsx:550:11.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:547:12 ↔ examples/room-yield/src/routes/live.tsx:550:18.
- CAPTURE_FALLBACK: examples/room-yield/src/routes/live.tsx:547:12 ↔ examples/room-yield/src/routes/live.tsx:556:25.

### Capture candidates

- examples/room-yield/src/routes/live.tsx:115:9: `me`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:116:9: `wire`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:265:9: `wire`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:264:9: `me`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:478:9: `wire`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:516:9: `wire`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:307:9: `transcriptRows`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:348:9: `me`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:395:9: `shown`: setup-local value is not proved serializable at the candidate root edge.
- examples/room-yield/src/routes/live.tsx:393:9: `me`: setup-local value is not proved serializable at the candidate root edge.

### Named U sources

- examples/room-yield/src/app.tsx:20:17: `Router` — foreign tag; 5 client parts.
- examples/room-yield/src/app.tsx:21:20: `props` — unresolved parameter (row, callback or foreign props); 5 client parts.
- examples/room-yield/src/routes/live.tsx:66:15: `String` — unanalysed call; 88 client parts.
- examples/room-yield/src/routes/live.tsx:128:26: `(yield* who).members.some` — unanalysed call; 11 client parts.
- examples/room-yield/src/routes/live.tsx:120:19: `() => wire.watch(presence(room2, me2))` — attempt target not proved a server function; 15 client parts.
- examples/room-yield/src/routes/live.tsx:121:13: `wire.watch` — unanalysed call; 15 client parts.
- examples/room-yield/src/routes/live.tsx:121:24: `presence` — unanalysed call; 15 client parts.
- examples/room-yield/src/components/status-pill.tsx:46:14: `src` — unresolved parameter (row, callback or foreign props); 30 client parts.
- examples/room-yield/src/routes/live.tsx:269:21: `() => wire.watch(transcript(room3))` — attempt target not proved a server function; 35 client parts.
- examples/room-yield/src/routes/live.tsx:270:15: `wire.watch` — unanalysed call; 35 client parts.
- examples/room-yield/src/routes/live.tsx:270:26: `transcript` — unanalysed call; 35 client parts.
- examples/room-yield/src/routes/live.tsx:290:25: `() => send(room, id, current.name, text).then(() => true as const)` — attempt target not proved a server function; 15 client parts.
- examples/room-yield/src/routes/live.tsx:291:13: `send(room, id, current.name, text).then` — unanalysed call; 15 client parts.
- examples/room-yield/src/routes/live.tsx:298:31: `s.messages.some` — unanalysed call; 15 client parts.
- examples/room-yield/src/routes/live.tsx:282:16: `Math.random().toString(36).slice` — unanalysed call; 15 client parts.
- examples/room-yield/src/routes/live.tsx:289:9: `failure: SendError | DeliveryError | undefined` — unread import or mutable binding; 15 client parts.
- examples/room-yield/src/routes/live.tsx:481:19: `() => wire.watch(presence(name2, null))` — attempt target not proved a server function; 12 client parts.
- examples/room-yield/src/routes/live.tsx:482:13: `wire.watch` — unanalysed call; 12 client parts.
- examples/room-yield/src/routes/live.tsx:482:24: `presence` — unanalysed call; 12 client parts.
- examples/room-yield/src/routes/live.tsx:523:19: `() => wire.watch(roomCard(room2))` — attempt target not proved a server function; 21 client parts.
- examples/room-yield/src/routes/live.tsx:524:13: `wire.watch` — unanalysed call; 21 client parts.
- examples/room-yield/src/routes/live.tsx:524:24: `roomCard` — unanalysed call; 21 client parts.
- examples/room-yield/src/routes/live.tsx:530:19: `() => card2.members` — attempt target not proved a server function; 19 client parts.
- examples/room-yield/src/routes/live.tsx:537:19: `() => card3.activity` — attempt target not proved a server function; 19 client parts.
- examples/room-yield/src/routes/live.tsx:742:19: `() => archive(room)` — attempt target not proved a server function; 9 client parts.
- examples/room-yield/src/routes/live.tsx:743:13: `archive` — unanalysed call; 9 client parts.
- examples/room-yield/src/lib/identity.tsx:58:35: `mint` — unanalysed call; 2 client parts.
- examples/room-yield/src/routes/live.tsx:76:63: `describe` — unanalysed call; 3 client parts.
- examples/room-yield/src/routes/live.tsx:76:72: `err` — unanalysed call; 3 client parts.
- examples/room-yield/src/components/status-pill.tsx:65:16: `describe` — unanalysed call; 11 client parts.
- examples/room-yield/src/routes/live.tsx:229:24: `() => fetch("/__chaos/drop", {   method: "POST" })` — attempt target not proved a server function; 8 client parts.
- examples/room-yield/src/routes/live.tsx:229:38: `fetch` — unanalysed call; 8 client parts.
- examples/room-yield/src/routes/live.tsx:233:18: `() => res.text()` — attempt target not proved a server function; 8 client parts.
- examples/room-yield/src/routes/live.tsx:233:32: `res.text` — unanalysed call; 8 client parts.
- examples/room-yield/src/routes/live.tsx:235:28: `String` — unanalysed call; 8 client parts.
- examples/room-yield/src/routes/live.tsx:225:9: `failure: ChaosError | undefined` — unread import or mutable binding; 8 client parts.
- examples/room-yield/src/routes/live.tsx:367:42: `new Date(yield* m.at).toLocaleTimeString` — unanalysed call; 11 client parts.
- examples/room-yield/src/routes/live.tsx:403:12: `yield* props.post` — unanalysed call; 8 client parts.
- examples/room-yield/src/routes/live.tsx:398:21: `(yield* text).trim` — unanalysed call; 8 client parts.
- examples/room-yield/src/routes/live.tsx:631:12: `Array.from` — unanalysed call; 15 client parts.
- examples/room-yield/src/routes/live.tsx:631:43: `i` — unresolved parameter (row, callback or foreign props); 15 client parts.
- examples/room-yield/src/routes/live.tsx:685:42: `describe` — unanalysed call; 7 client parts.
- examples/room-yield/src/routes/live.tsx:681:34: `err` — unresolved parameter (row, callback or foreign props); 8 client parts.
- examples/room-yield/src/routes/live.tsx:681:52: `reset` — unresolved parameter (row, callback or foreign props); 7 client parts.
- examples/room-yield/src/routes/live.tsx:723:21: `() => summary(room4, attempt2)` — attempt target not proved a server function; 12 client parts.
- examples/room-yield/src/routes/live.tsx:724:15: `summary` — unanalysed call; 12 client parts.
- examples/room-yield/src/routes.ts:18:50: `foreign` — unanalysed call; 1 client parts.

### Setup findings


## sierpinski-yield

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: eager, 40 parts; span examples/sierpinski-yield/src/app.tsx:79:7; components TriangleDemo, Triangle, Dot, Container; sites examples/sierpinski-yield/src/app.tsx:52:40, examples/sierpinski-yield/src/app.tsx:53:40, examples/sierpinski-yield/src/app.tsx:54:24, examples/sierpinski-yield/src/app.tsx:59:16, examples/sierpinski-yield/src/app.tsx:65:18, examples/sierpinski-yield/src/app.tsx:128:31, examples/sierpinski-yield/src/app.tsx:251:36, examples/sierpinski-yield/src/app.tsx:252:19, examples/sierpinski-yield/src/app.tsx:255:18, examples/sierpinski-yield/src/app.tsx:81:11, examples/sierpinski-yield/src/app.tsx:81:18, examples/sierpinski-yield/src/app.tsx:87:21, examples/sierpinski-yield/src/app.tsx:87:28, examples/sierpinski-yield/src/app.tsx:90:35, examples/sierpinski-yield/src/app.tsx:110:35, examples/sierpinski-yield/src/app.tsx:113:10, examples/sierpinski-yield/src/app.tsx:156:11, examples/sierpinski-yield/src/app.tsx:156:18, examples/sierpinski-yield/src/app.tsx:161:21, examples/sierpinski-yield/src/app.tsx:161:28, examples/sierpinski-yield/src/app.tsx:163:33, examples/sierpinski-yield/src/app.tsx:171:31, examples/sierpinski-yield/src/app.tsx:188:21, examples/sierpinski-yield/src/app.tsx:188:28, examples/sierpinski-yield/src/app.tsx:190:33, examples/sierpinski-yield/src/app.tsx:196:31, examples/sierpinski-yield/src/app.tsx:208:31, examples/sierpinski-yield/src/app.tsx:222:31, examples/sierpinski-yield/src/app.tsx:264:19, examples/sierpinski-yield/src/app.tsx:265:20, examples/sierpinski-yield/src/app.tsx:266:18, examples/sierpinski-yield/src/app.tsx:267:17, examples/sierpinski-yield/src/app.tsx:268:29, examples/sierpinski-yield/src/app.tsx:269:27, examples/sierpinski-yield/src/app.tsx:270:24, examples/sierpinski-yield/src/app.tsx:272:23, examples/sierpinski-yield/src/app.tsx:273:23, examples/sierpinski-yield/src/app.tsx:275:11, examples/sierpinski-yield/src/app.tsx:275:35, examples/sierpinski-yield/src/app.tsx:275:67. Fallback: unproved setup work.

### Additional safety merges

- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:52:40 ↔ examples/sierpinski-yield/src/app.tsx:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:53:40 ↔ examples/sierpinski-yield/src/app.tsx:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:54:24 ↔ examples/sierpinski-yield/src/app.tsx:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:59:16 ↔ examples/sierpinski-yield/src/app.tsx:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:65:18 ↔ examples/sierpinski-yield/src/app.tsx:81:11.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:65:18 ↔ examples/sierpinski-yield/src/app.tsx:81:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:65:18 ↔ examples/sierpinski-yield/src/app.tsx:87:21.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:65:18 ↔ examples/sierpinski-yield/src/app.tsx:87:28.
- CAPTURE_FALLBACK: examples/sierpinski-yield/src/app.tsx:65:18 ↔ examples/sierpinski-yield/src/app.tsx:90:35.

### Capture candidates

- examples/sierpinski-yield/src/app.tsx:58:9: `start`: setup-local value is not proved serializable at the candidate root edge.

### Named U sources

- examples/sierpinski-yield/src/app.tsx:131:21: `() => new Promise<number>(res => {   const t = requestIdleCallback(() => {     const e = performance` — attempt target not proved a server function; 27 client parts.
- examples/sierpinski-yield/src/app.tsx:58:17: `Date.now` — unanalysed call; 1 client parts.

### Setup findings

- examples/sierpinski-yield/src/app.tsx:58:17: setup call Date.now is not proved inert; eager fallback required.
- examples/sierpinski-yield/src/app.tsx:62:13: setup call setInterval is not proved inert; eager fallback required.
- examples/sierpinski-yield/src/app.tsx:69:7: setup call requestAnimationFrame is not proved inert; eager fallback required.

## sierpinski-yield-h

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: eager, 25 parts; span examples/sierpinski-yield-h/src/app.ts:78:12; components TriangleDemo, Container, Triangle, Dot; sites examples/sierpinski-yield-h/src/app.ts:52:40, examples/sierpinski-yield-h/src/app.ts:53:40, examples/sierpinski-yield-h/src/app.ts:54:24, examples/sierpinski-yield-h/src/app.ts:59:16, examples/sierpinski-yield-h/src/app.ts:65:18, examples/sierpinski-yield-h/src/app.ts:92:16, examples/sierpinski-yield-h/src/app.ts:116:23, examples/sierpinski-yield-h/src/app.ts:122:23, examples/sierpinski-yield-h/src/app.ts:128:23, examples/sierpinski-yield-h/src/app.ts:134:22, examples/sierpinski-yield-h/src/app.ts:140:25, examples/sierpinski-yield-h/src/app.ts:146:23, examples/sierpinski-yield-h/src/app.ts:152:24, examples/sierpinski-yield-h/src/app.ts:159:31, examples/sierpinski-yield-h/src/app.ts:194:36, examples/sierpinski-yield-h/src/app.ts:195:19, examples/sierpinski-yield-h/src/app.ts:198:18, examples/sierpinski-yield-h/src/app.ts:207:16, examples/sierpinski-yield-h/src/app.ts:218:23, examples/sierpinski-yield-h/src/app.ts:219:23, examples/sierpinski-yield-h/src/app.ts:221:7, examples/sierpinski-yield-h/src/app.ts:78:12, examples/sierpinski-yield-h/src/app.ts:81:7, examples/sierpinski-yield-h/src/app.ts:179:12, examples/sierpinski-yield-h/src/app.ts:181:17. Fallback: unproved setup work.

### Additional safety merges

- CAPTURE_FALLBACK: examples/sierpinski-yield-h/src/app.ts:52:40 ↔ examples/sierpinski-yield-h/src/app.ts:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield-h/src/app.ts:53:40 ↔ examples/sierpinski-yield-h/src/app.ts:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield-h/src/app.ts:54:24 ↔ examples/sierpinski-yield-h/src/app.ts:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield-h/src/app.ts:59:16 ↔ examples/sierpinski-yield-h/src/app.ts:65:18.
- CAPTURE_FALLBACK: examples/sierpinski-yield-h/src/app.ts:65:18 ↔ examples/sierpinski-yield-h/src/app.ts:78:12.
- CAPTURE_FALLBACK: examples/sierpinski-yield-h/src/app.ts:65:18 ↔ examples/sierpinski-yield-h/src/app.ts:81:7.

### Capture candidates

- examples/sierpinski-yield-h/src/app.ts:58:9: `start`: setup-local value is not proved serializable at the candidate root edge.

### Named U sources

- examples/sierpinski-yield-h/src/app.ts:162:21: `() => new Promise<number>(res => {   const t = requestIdleCallback(() => {     const e = performance` — attempt target not proved a server function; 14 client parts.
- examples/sierpinski-yield-h/src/app.ts:58:17: `Date.now` — unanalysed call; 1 client parts.
- examples/sierpinski-yield-h/src/app.ts:20:3: `Errored` — unread import or mutable binding; 1 client parts.
- examples/sierpinski-yield-h/src/app.ts:21:3: `Loading` — unread import or mutable binding; 2 client parts.

### Setup findings

- examples/sierpinski-yield-h/src/app.ts:58:17: setup call Date.now is not proved inert; eager fallback required.
- examples/sierpinski-yield-h/src/app.ts:62:13: setup call setInterval is not proved inert; eager fallback required.
- examples/sierpinski-yield-h/src/app.ts:69:7: setup call requestAnimationFrame is not proved inert; eager fallback required.

## todos-yield

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: eager, 57 parts; span examples/todos-yield/src/app.tsx:298:7; components Header, TodoItem, MainSection, Footer, TodoApp, App; sites examples/todos-yield/src/app.tsx:59:18, examples/todos-yield/src/app.tsx:86:18, examples/todos-yield/src/app.tsx:89:17, examples/todos-yield/src/app.tsx:92:18, examples/todos-yield/src/app.tsx:140:27, examples/todos-yield/src/app.tsx:150:31, examples/todos-yield/src/app.tsx:153:18, examples/todos-yield/src/app.tsx:199:28, examples/todos-yield/src/app.tsx:202:28, examples/todos-yield/src/app.tsx:205:17, examples/todos-yield/src/todos.ts:99:36, examples/todos-yield/src/todos.ts:106:14, examples/todos-yield/src/todos.ts:116:17, examples/todos-yield/src/todos.ts:122:17, examples/todos-yield/src/todos.ts:134:16, examples/todos-yield/src/todos.ts:157:21, examples/todos-yield/src/todos.ts:172:21, examples/todos-yield/src/filter.ts:21:38, examples/todos-yield/src/filter.ts:22:20, examples/todos-yield/src/filter.ts:25:10, examples/todos-yield/src/app.tsx:47:10, examples/todos-yield/src/app.tsx:77:22, examples/todos-yield/src/app.tsx:112:22, examples/todos-yield/src/app.tsx:116:13, examples/todos-yield/src/app.tsx:116:20, examples/todos-yield/src/app.tsx:124:32, examples/todos-yield/src/app.tsx:131:44, examples/todos-yield/src/app.tsx:160:11, examples/todos-yield/src/app.tsx:160:18, examples/todos-yield/src/app.tsx:162:23, examples/todos-yield/src/app.tsx:171:30, examples/todos-yield/src/app.tsx:172:31, examples/todos-yield/src/app.tsx:177:23, examples/todos-yield/src/app.tsx:177:30, examples/todos-yield/src/app.tsx:181:39, examples/todos-yield/src/app.tsx:212:11, examples/todos-yield/src/app.tsx:212:18, examples/todos-yield/src/app.tsx:214:23, examples/todos-yield/src/app.tsx:220:30, examples/todos-yield/src/app.tsx:221:23, examples/todos-yield/src/app.tsx:225:56, examples/todos-yield/src/app.tsx:230:62, examples/todos-yield/src/app.tsx:237:45, examples/todos-yield/src/app.tsx:244:21, examples/todos-yield/src/app.tsx:244:28, examples/todos-yield/src/app.tsx:246:33, examples/todos-yield/src/app.tsx:250:68, examples/todos-yield/src/app.tsx:272:10, examples/todos-yield/src/app.tsx:274:11, examples/todos-yield/src/app.tsx:274:18, examples/todos-yield/src/app.tsx:281:20, examples/todos-yield/src/app.tsx:282:20, examples/todos-yield/src/app.tsx:300:11, examples/todos-yield/src/app.tsx:306:21, examples/todos-yield/src/app.tsx:306:28, examples/todos-yield/src/app.tsx:314:35, examples/todos-yield/src/app.tsx:300:18.
  - Effect examples/todos-yield/src/filter.ts:25:10; touched: examples/todos-yield/src/filter.ts:22:20, examples/todos-yield/src/filter.ts:21:38; pulled in: examples/todos-yield/src/app.tsx:59:18, examples/todos-yield/src/app.tsx:86:18, examples/todos-yield/src/app.tsx:89:17, examples/todos-yield/src/app.tsx:92:18, examples/todos-yield/src/app.tsx:140:27, examples/todos-yield/src/app.tsx:150:31, examples/todos-yield/src/app.tsx:153:18, examples/todos-yield/src/app.tsx:199:28, examples/todos-yield/src/app.tsx:202:28, examples/todos-yield/src/app.tsx:205:17, examples/todos-yield/src/todos.ts:99:36, examples/todos-yield/src/todos.ts:106:14, examples/todos-yield/src/todos.ts:116:17, examples/todos-yield/src/todos.ts:122:17, examples/todos-yield/src/todos.ts:134:16, examples/todos-yield/src/todos.ts:157:21, examples/todos-yield/src/todos.ts:172:21, examples/todos-yield/src/app.tsx:47:10, examples/todos-yield/src/app.tsx:77:22, examples/todos-yield/src/app.tsx:112:22, examples/todos-yield/src/app.tsx:116:13, examples/todos-yield/src/app.tsx:116:20, examples/todos-yield/src/app.tsx:124:32, examples/todos-yield/src/app.tsx:131:44, examples/todos-yield/src/app.tsx:160:11, examples/todos-yield/src/app.tsx:160:18, examples/todos-yield/src/app.tsx:162:23, examples/todos-yield/src/app.tsx:171:30, examples/todos-yield/src/app.tsx:172:31, examples/todos-yield/src/app.tsx:177:23, examples/todos-yield/src/app.tsx:177:30, examples/todos-yield/src/app.tsx:181:39, examples/todos-yield/src/app.tsx:212:11, examples/todos-yield/src/app.tsx:212:18, examples/todos-yield/src/app.tsx:214:23, examples/todos-yield/src/app.tsx:220:30, examples/todos-yield/src/app.tsx:221:23, examples/todos-yield/src/app.tsx:225:56, examples/todos-yield/src/app.tsx:230:62, examples/todos-yield/src/app.tsx:237:45, examples/todos-yield/src/app.tsx:244:21, examples/todos-yield/src/app.tsx:244:28, examples/todos-yield/src/app.tsx:246:33, examples/todos-yield/src/app.tsx:250:68, examples/todos-yield/src/app.tsx:272:10, examples/todos-yield/src/app.tsx:274:11, examples/todos-yield/src/app.tsx:274:18, examples/todos-yield/src/app.tsx:281:20, examples/todos-yield/src/app.tsx:282:20, examples/todos-yield/src/app.tsx:300:11, examples/todos-yield/src/app.tsx:306:21, examples/todos-yield/src/app.tsx:306:28, examples/todos-yield/src/app.tsx:314:35, examples/todos-yield/src/app.tsx:300:18.

### Additional safety merges

- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:300:11 ↔ examples/todos-yield/src/app.tsx:306:21.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:300:11 ↔ examples/todos-yield/src/app.tsx:306:28.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:314:35 ↔ examples/todos-yield/src/app.tsx:300:11.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:300:11 ↔ examples/todos-yield/src/app.tsx:300:18.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:306:21 ↔ examples/todos-yield/src/app.tsx:306:28.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:314:35 ↔ examples/todos-yield/src/app.tsx:306:21.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:300:18 ↔ examples/todos-yield/src/app.tsx:306:21.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:314:35 ↔ examples/todos-yield/src/app.tsx:306:28.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:300:18 ↔ examples/todos-yield/src/app.tsx:306:28.
- CAPTURE_FALLBACK: examples/todos-yield/src/app.tsx:314:35 ↔ examples/todos-yield/src/app.tsx:300:18.

### Capture candidates

- examples/todos-yield/src/app.tsx:294:9: `filter`: setup-local value is not proved serializable at the candidate root edge.

### Named U sources

- examples/todos-yield/src/app.tsx:144:11: `t.filter` — unanalysed call; 18 client parts.
- examples/todos-yield/src/app.tsx:144:20: `x` — unresolved parameter (row, callback or foreign props); 18 client parts.
- examples/todos-yield/src/app.tsx:146:13: `t.filter` — unanalysed call; 18 client parts.
- examples/todos-yield/src/app.tsx:146:22: `x` — unresolved parameter (row, callback or foreign props); 18 client parts.
- examples/todos-yield/src/app.tsx:142:36: `t` — unresolved parameter (row, callback or foreign props); 18 client parts.
- examples/todos-yield/src/filter.ts:21:54: `parseHash` — unanalysed call; 27 client parts.
- examples/todos-yield/src/filter.ts:21:64: `location` — unresolved global; 27 client parts.
- examples/todos-yield/src/filter.ts:23:22: `parseHash` — unanalysed call; 26 client parts.
- examples/todos-yield/src/filter.ts:23:32: `location` — unresolved global; 26 client parts.
- examples/todos-yield/src/filter.ts:29:29: `window.removeEventListener` — unanalysed call; 25 client parts.
- examples/todos-yield/src/app.tsx:67:12: `yield* addTodo` — unanalysed call; 8 client parts.
- examples/todos-yield/src/app.tsx:62:19: `input.value.trim` — unanalysed call; 8 client parts.
- examples/todos-yield/src/app.tsx:87:12: `yield* toggleTodo` — unanalysed call; 15 client parts.
- examples/todos-yield/src/app.tsx:90:12: `yield* retryTodo` — unanalysed call; 17 client parts.
- examples/todos-yield/src/app.tsx:93:12: `yield* removeTodo` — unanalysed call; 15 client parts.
- examples/todos-yield/src/app.tsx:151:57: `t.every` — unanalysed call; 14 client parts.
- examples/todos-yield/src/app.tsx:151:65: `x` — unresolved parameter (row, callback or foreign props); 14 client parts.
- examples/todos-yield/src/app.tsx:154:12: `yield* toggleAll` — unanalysed call; 12 client parts.
- examples/todos-yield/src/app.tsx:206:12: `yield* clearCompleted` — unanalysed call; 14 client parts.
- examples/todos-yield/src/todos.ts:100:34: `() => api.getTodos()` — attempt target not proved a server function; 50 client parts.
- examples/todos-yield/src/todos.ts:100:48: `api.getTodos` — unanalysed call; 50 client parts.
- examples/todos-yield/src/todos.ts:112:18: `() => settled(api.addTodo(todo))` — attempt target not proved a server function; 45 client parts.
- examples/todos-yield/src/todos.ts:112:32: `settled` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:112:40: `api.addTodo` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:117:28: `t.filter` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:118:18: `() => settled(api.removeTodo(id))` — attempt target not proved a server function; 45 client parts.
- examples/todos-yield/src/todos.ts:118:32: `settled` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:118:40: `api.removeTodo` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:130:18: `() => settled(api.toggleTodo(id, completed))` — attempt target not proved a server function; 45 client parts.
- examples/todos-yield/src/todos.ts:130:32: `settled` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:130:40: `api.toggleTodo` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:136:9: `t.filter(x => x.completed !== completed).map` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:147:18: `() => settled(api.toggleAll(ids, completed))` — attempt target not proved a server function; 45 client parts.
- examples/todos-yield/src/todos.ts:147:32: `settled` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:147:40: `api.toggleAll` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:158:48: `t.filter(x => x.completed).map` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:159:28: `t.filter` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:160:18: `() => settled(api.clearCompleted(ids))` — attempt target not proved a server function; 45 client parts.
- examples/todos-yield/src/todos.ts:160:32: `settled` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:160:40: `api.clearCompleted` — unanalysed call; 45 client parts.
- examples/todos-yield/src/todos.ts:177:12: `retry` — unanalysed call; 45 client parts.
- examples/todos-yield/src/app.tsx:309:53: `String` — unanalysed call; 4 client parts.
- examples/todos-yield/src/app.tsx:309:60: `err` — unanalysed call; 4 client parts.
- examples/todos-yield/src/app.tsx:307:39: `reset` — unresolved parameter (row, callback or foreign props); 4 client parts.

### Setup findings


## todos-yield-h

Limits: Joined props lose per-call precision; Spans unresolved across foreign ownership; no dynamic root counts; Capture and span-overlap fallbacks are separate from M1-M6; Foreign and helper calls may hide ownership; Not safe as a codegen input.

### Roots and effect reach

- Root 1: eager, 36 parts; span examples/todos-yield-h/src/app.ts:241:12; components Header, TodoItem, MainSection, Footer, App; sites examples/todos-yield-h/src/app.ts:50:18, examples/todos-yield-h/src/app.ts:69:20, examples/todos-yield-h/src/app.ts:77:18, examples/todos-yield-h/src/app.ts:80:17, examples/todos-yield-h/src/app.ts:83:18, examples/todos-yield-h/src/app.ts:107:20, examples/todos-yield-h/src/app.ts:119:26, examples/todos-yield-h/src/app.ts:124:50, examples/todos-yield-h/src/app.ts:132:27, examples/todos-yield-h/src/app.ts:142:31, examples/todos-yield-h/src/app.ts:148:18, examples/todos-yield-h/src/app.ts:161:20, examples/todos-yield-h/src/app.ts:162:21, examples/todos-yield-h/src/app.ts:186:17, examples/todos-yield-h/src/app.ts:195:11, examples/todos-yield-h/src/app.ts:196:18, examples/todos-yield-h/src/app.ts:200:9, examples/todos-yield-h/src/app.ts:230:70, examples/todos-yield-h/src/app.ts:249:36, examples/todos-yield-h/src/todos.ts:99:36, examples/todos-yield-h/src/todos.ts:106:14, examples/todos-yield-h/src/todos.ts:116:17, examples/todos-yield-h/src/todos.ts:122:17, examples/todos-yield-h/src/todos.ts:134:16, examples/todos-yield-h/src/todos.ts:157:21, examples/todos-yield-h/src/todos.ts:172:21, examples/todos-yield-h/src/filter.ts:21:38, examples/todos-yield-h/src/filter.ts:22:20, examples/todos-yield-h/src/filter.ts:25:10, examples/todos-yield-h/src/app.ts:110:9, examples/todos-yield-h/src/app.ts:152:12, examples/todos-yield-h/src/app.ts:168:11, examples/todos-yield-h/src/app.ts:204:12, examples/todos-yield-h/src/app.ts:226:9, examples/todos-yield-h/src/app.ts:241:12, examples/todos-yield-h/src/app.ts:259:11.
  - Effect examples/todos-yield-h/src/filter.ts:25:10; touched: examples/todos-yield-h/src/filter.ts:22:20, examples/todos-yield-h/src/filter.ts:21:38; pulled in: examples/todos-yield-h/src/app.ts:50:18, examples/todos-yield-h/src/app.ts:69:20, examples/todos-yield-h/src/app.ts:77:18, examples/todos-yield-h/src/app.ts:80:17, examples/todos-yield-h/src/app.ts:83:18, examples/todos-yield-h/src/app.ts:107:20, examples/todos-yield-h/src/app.ts:119:26, examples/todos-yield-h/src/app.ts:124:50, examples/todos-yield-h/src/app.ts:132:27, examples/todos-yield-h/src/app.ts:142:31, examples/todos-yield-h/src/app.ts:148:18, examples/todos-yield-h/src/app.ts:161:20, examples/todos-yield-h/src/app.ts:162:21, examples/todos-yield-h/src/app.ts:186:17, examples/todos-yield-h/src/app.ts:195:11, examples/todos-yield-h/src/app.ts:196:18, examples/todos-yield-h/src/app.ts:200:9, examples/todos-yield-h/src/app.ts:230:70, examples/todos-yield-h/src/app.ts:249:36, examples/todos-yield-h/src/todos.ts:99:36, examples/todos-yield-h/src/todos.ts:106:14, examples/todos-yield-h/src/todos.ts:116:17, examples/todos-yield-h/src/todos.ts:122:17, examples/todos-yield-h/src/todos.ts:134:16, examples/todos-yield-h/src/todos.ts:157:21, examples/todos-yield-h/src/todos.ts:172:21, examples/todos-yield-h/src/app.ts:110:9, examples/todos-yield-h/src/app.ts:152:12, examples/todos-yield-h/src/app.ts:168:11, examples/todos-yield-h/src/app.ts:204:12, examples/todos-yield-h/src/app.ts:226:9, examples/todos-yield-h/src/app.ts:241:12, examples/todos-yield-h/src/app.ts:259:11.

### Additional safety merges

- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:186:17 ↔ examples/todos-yield-h/src/app.ts:204:12.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:195:11 ↔ examples/todos-yield-h/src/app.ts:204:12.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:196:18 ↔ examples/todos-yield-h/src/app.ts:204:12.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:200:9 ↔ examples/todos-yield-h/src/app.ts:204:12.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:204:12 ↔ examples/todos-yield-h/src/app.ts:230:70.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:204:12 ↔ examples/todos-yield-h/src/app.ts:226:9.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:241:12 ↔ examples/todos-yield-h/src/app.ts:249:36.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:241:12 ↔ examples/todos-yield-h/src/app.ts:259:11.
- CAPTURE_FALLBACK: examples/todos-yield-h/src/app.ts:249:36 ↔ examples/todos-yield-h/src/app.ts:259:11.

### Capture candidates

- examples/todos-yield-h/src/app.ts:189:9: `link`: setup-local value is not proved serializable at the candidate root edge.
- examples/todos-yield-h/src/app.ts:238:9: `filter`: setup-local value is not proved serializable at the candidate root edge.

### Named U sources

- examples/todos-yield-h/src/app.ts:78:12: `yield* toggleTodo` — unanalysed call; 6 client parts.
- examples/todos-yield-h/src/app.ts:81:12: `yield* retryTodo` — unanalysed call; 7 client parts.
- examples/todos-yield-h/src/app.ts:84:12: `yield* removeTodo` — unanalysed call; 6 client parts.
- examples/todos-yield-h/src/app.ts:136:11: `t.filter` — unanalysed call; 8 client parts.
- examples/todos-yield-h/src/app.ts:136:20: `x` — unresolved parameter (row, callback or foreign props); 8 client parts.
- examples/todos-yield-h/src/app.ts:138:13: `t.filter` — unanalysed call; 8 client parts.
- examples/todos-yield-h/src/app.ts:138:22: `x` — unresolved parameter (row, callback or foreign props); 8 client parts.
- examples/todos-yield-h/src/app.ts:134:36: `t` — unresolved parameter (row, callback or foreign props); 8 client parts.
- examples/todos-yield-h/src/app.ts:58:12: `yield* addTodo` — unanalysed call; 3 client parts.
- examples/todos-yield-h/src/app.ts:53:19: `input.value.trim` — unanalysed call; 3 client parts.
- examples/todos-yield-h/src/app.ts:143:57: `t.every` — unanalysed call; 7 client parts.
- examples/todos-yield-h/src/app.ts:143:65: `x` — unresolved parameter (row, callback or foreign props); 7 client parts.
- examples/todos-yield-h/src/app.ts:149:12: `yield* toggleAll` — unanalysed call; 5 client parts.
- examples/todos-yield-h/src/filter.ts:21:54: `parseHash` — unanalysed call; 12 client parts.
- examples/todos-yield-h/src/filter.ts:21:64: `location` — unresolved global; 12 client parts.
- examples/todos-yield-h/src/filter.ts:23:22: `parseHash` — unanalysed call; 11 client parts.
- examples/todos-yield-h/src/filter.ts:23:32: `location` — unresolved global; 11 client parts.
- examples/todos-yield-h/src/filter.ts:29:29: `window.removeEventListener` — unanalysed call; 10 client parts.
- examples/todos-yield-h/src/app.ts:187:12: `yield* clearCompleted` — unanalysed call; 6 client parts.
- examples/todos-yield-h/src/app.ts:189:46: `value` — unresolved parameter (row, callback or foreign props); 3 client parts.
- examples/todos-yield-h/src/app.ts:222:11: `link` — unanalysed call; 3 client parts.
- examples/todos-yield-h/src/app.ts:223:11: `link` — unanalysed call; 3 client parts.
- examples/todos-yield-h/src/app.ts:224:11: `link` — unanalysed call; 3 client parts.
- examples/todos-yield-h/src/todos.ts:100:34: `() => api.getTodos()` — attempt target not proved a server function; 7 client parts.
- examples/todos-yield-h/src/todos.ts:100:48: `api.getTodos` — unanalysed call; 7 client parts.
- examples/todos-yield-h/src/todos.ts:112:18: `() => settled(api.addTodo(todo))` — attempt target not proved a server function; 2 client parts.
- examples/todos-yield-h/src/todos.ts:112:32: `settled` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:112:40: `api.addTodo` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:117:28: `t.filter` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:118:18: `() => settled(api.removeTodo(id))` — attempt target not proved a server function; 2 client parts.
- examples/todos-yield-h/src/todos.ts:118:32: `settled` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:118:40: `api.removeTodo` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:130:18: `() => settled(api.toggleTodo(id, completed))` — attempt target not proved a server function; 2 client parts.
- examples/todos-yield-h/src/todos.ts:130:32: `settled` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:130:40: `api.toggleTodo` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:136:9: `t.filter(x => x.completed !== completed).map` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:147:18: `() => settled(api.toggleAll(ids, completed))` — attempt target not proved a server function; 2 client parts.
- examples/todos-yield-h/src/todos.ts:147:32: `settled` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:147:40: `api.toggleAll` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:158:48: `t.filter(x => x.completed).map` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:159:28: `t.filter` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:160:18: `() => settled(api.clearCompleted(ids))` — attempt target not proved a server function; 2 client parts.
- examples/todos-yield-h/src/todos.ts:160:32: `settled` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:160:40: `api.clearCompleted` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/todos.ts:177:12: `retry` — unanalysed call; 2 client parts.
- examples/todos-yield-h/src/app.ts:15:3: `Errored` — unread import or mutable binding; 1 client parts.
- examples/todos-yield-h/src/app.ts:248:46: `String` — unanalysed call; 1 client parts.
- examples/todos-yield-h/src/app.ts:248:53: `err` — unanalysed call; 1 client parts.
- examples/todos-yield-h/src/app.ts:244:25: `reset` — unresolved parameter (row, callback or foreign props); 2 client parts.
- examples/todos-yield-h/src/app.ts:17:3: `Loading` — unread import or mutable binding; 2 client parts.
- examples/todos-yield-h/src/app.ts:189:17: `href` — unresolved parameter (row, callback or foreign props); 3 client parts.
- examples/todos-yield-h/src/app.ts:189:31: `label` — unresolved parameter (row, callback or foreign props); 3 client parts.

### Setup findings

