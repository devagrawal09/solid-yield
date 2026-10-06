# C1b: interaction reachability and a tier-3 cost floor

2026-10-07. Report only. C2, application code and the runtime are unchanged. No resumer has been built.

## Result

All numbers below are bytes of transformed, unbundled source, not minified downloads, time, or speedups. The main lower-bound column is a **conditional first-use budget**: the union of code ranges across the script. The library columns are measured V8 phase totals, which count a reused range again in each phase. Their ratio answers the requested optimistic floor question; it is **not a prediction of tier-3 execution or a like-for-like saving**. The reset proxy below counts repeated application bodies plus the empty-root idle runtime in every phase. Neither estimate includes the extra runtime work of real interactions.

| Twin | Library load | Tier-3 load floor | Load ratio | Library script | Tier-3 first-use floor | Ratio | Reset proxy / library |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| docs-yield | 584,641 | 348,751 | 59.7% | 2,774,497 | 355,594 | 12.8% | 15.1% |
| effect-yield | 2,484,052 | 348,751 | 14.0% | 8,908,050 | 363,866 | 4.1% | 7.4% |
| hackernews-spa-yield | 541,596 | 348,751 | 64.4% | 3,544,424 | 353,440 | 10.0% | 11.3% |
| rendering-yield | 405,176 | 348,751 | 86.1% | 4,565,342 | 358,090 | 7.8% | 10.9% |
| room-yield | 637,159 | 348,751 | 54.7% | 2,396,766 | 356,977 | 14.9% | 17.2% |
| sierpinski-yield | 412,251 | 348,751 | 84.6% | 1,423,200 | 351,125 | 24.7% | 27.0% |
| sierpinski-yield-h | 414,130 | 348,751 | 84.2% | 1,453,645 | 350,818 | 24.1% | 26.3% |
| todos-yield | 438,644 | 348,751 | 79.5% | 4,940,262 | 357,216 | 7.2% | 10.6% |
| todos-yield-h | 444,098 | 348,751 | 78.5% | 5,242,873 | 356,270 | 6.8% | 9.5% |

| Twin | Graph parts | Events (bound) | Median reached, all events | Median, bound events | Worst reach |
| --- | ---: | ---: | ---: | ---: | ---: |
| docs-yield | 256 | 7 (7) | 4.3% | 4.3% | 4.7% |
| effect-yield | 99 | 14 (11) | 19.2% | 24.2% | 75.8% |
| hackernews-spa-yield | 75 | 1 (1) | 6.7% | 6.7% | 6.7% |
| rendering-yield | 217 | 23 (21) | 10.6% | 10.6% | 76.5% |
| room-yield | 122 | 9 (4) | 7.4% | 6.1% | 18.9% |
| sierpinski-yield | 24 | 4 (2) | 31.3% | 33.3% | 33.3% |
| sierpinski-yield-h | 28 | 4 (2) | 39.3% | 53.6% | 53.6% |
| todos-yield | 53 | 14 (7) | 58.5% | 58.5% | 67.9% |
| todos-yield-h | 49 | 14 (7) | 58.2% | 59.2% | 69.4% |

| Twin | Median scripted interaction reach | Worst scripted interaction | Reach |
| --- | ---: | --- | ---: |
| docs-yield | 4.3% | navigate to /docs/start | 25.4% |
| effect-yield | 35.4% | open the checkout tab | 65.7% |
| hackernews-spa-yield | 45.3% | next page | 45.3% |
| rendering-yield | 30.4% | Profile | 79.3% |
| room-yield | 28.7% | switch to #infra from the directory | 87.7% |
| sierpinski-yield | 33.3% | hover the first dot | 33.3% |
| sierpinski-yield-h | 53.6% | hover the first dot | 53.6% |
| todos-yield | 58.5% | retry succeeds | 67.9% |
| todos-yield-h | 59.2% | retry succeeds | 69.4% |

## What was counted

The directed pass follows each event's writes (including store updater reads, refreshes and optimistic/error-path writes), called events, dependent memos, effects and holes. Reads needed before a write pull in their upstream sources, including pending sources, without waking unrelated readers. Effects can write further sources. Changed flows include recreated child bodies but do not call those children's handlers. Callback identity includes its function site, so a returned fallback and the helper that creates it are distinct. Dynamic action lookup takes the union of known alternatives (TodoMVC retry). Foreign router/transport changes are explicit phase inputs, not invented application signal writes.

A graph part is a non-structural hole, bind, cell, memo, effect, event, timer, flow or boundary, including inert parts. Counts are C1-style call-site instances; repeated rows and recursive families have one static representative. Fractions describe this graph, not runtime node counts. Same source code shared by multiple instances counts once in bytes. Event tables include callable and background events as well as DOM-bound events; bound-only medians are separate. Source IDs, direct edges, all reached IDs, projected generated ranges and data estimates are in compiler-reachability.json.

Code bytes are the union of source-map segments in the yield + Solid + Vite module-runner output whose authored positions fall inside the reached handler, memo, initializer, effect or hole body. Helper bodies invoked by those bodies are included. UTF-16 offsets become UTF-8 byte lengths, as in the executed-bytes harness. These are exactly the selected **mapped spans**, not proof that every branch executes. Unmapped scaffolding, imports, descriptors, DOM templates outside holes and opaque dependency-package calls are omitted. A static may-reach union can include unexecuted branches; combined with omitted runtime work this is an optimistic model, not a mathematically certified lower bound.

Data bytes are UTF-8 JSON value sizes (undefined uses its 9-byte literal), with no envelope/key/identity cost. Sources appear once per edge; separate memo values count separately. Serializable lexical captures, such as carousel pictures, are included. Docs site/article/comments come from an actual completed library SSR payload; its hash and extracted values are recorded in compiler-reachability-data.json. Other values are initial literals or explicit estimates of representative fake API/parity data. These are initial/representative edge sizes, not maxima over edits or an implemented serializer. Errors, live iterators, functions, contexts and pending ownership require descriptors/transport not priced here; their serializability is not proved. See reachability-data.js for each value and basis.

## Empty-root measurement and assumptions

The empty hydrated root retains its server node. Cold core: **346,631** bytes; empty shell: **2,120**; total load: **348,751**. An idle flush executes **1,841** core bytes. The core includes solid-yield/internal, the public hydrate entry, Solid web and their transitive signal/owner dependencies. Loading only internal and web while omitting those dependencies would undercount. Tooling and SSR work are excluded.

The probe uses the same Vite browser environment as hydrated docs. Despite production mode/conditions, the installed plugin resolves .dev.js files; the raw core record names them. This is the recorded harness path, not a claim about a minified production build. The benchmark selector also admits @solidjs/vite-plugin/dist; the core probe excludes that tooling. Existing baseline numbers are preserved, so that small scope mismatch is explicit.

- Load assumes one shell hydration, settled SSR data, and no application root bodies. Descriptors cost approximately zero. The current public-library empty root is a proxy for this hypothetical shell, not proof that any possible resumer must execute exactly this core.
- First use pays the touched C1b group's initializer/memo/effect/hole bodies. Later steps pay only code ranges not previously charged in the first-use budget. All shared ranges, including runtime already charged at load, are counted once across steps. The reset proxy instead repeats body ranges and idle runtime per phase.
- C1b corrects callback/error reach only in its subclass; original C1 placement and C2 output do not change. C1b materialization groups may differ from the published C1 count. Docs' published C1 remains eleven groups; physical C2 remains seven roots.
- The exact authored phase order is retained. Settlements, reconnects, timers, animation frames, hash changes, error retries and navigation are charged explicitly. Continuations conservatively reuse the initiating handler's whole static slice. A group recreated on navigation is assumed to reuse code already charged; live instance/data recreation is not free in a real runtime.
- Room identity/presence and Sierpinski clocks require work without a user interaction. The first background phase must materialize them. A strict policy of doing nothing until a user event cannot preserve these parity scripts. CSR twins also need an SSR-data path they do not currently have. Treat their floor as conditional on solving these semantic requirements.
- Router, Effect, transport, serializer, disposal, ownership, error routing, DOM updates and group creation costs above the empty runtime are omitted. Effect's low ratio in particular is dominated by unpriced package work. No benchmark here establishes that those bytes disappear.

## Per-twin details

### docs-yield

C1b materialization groups: 12. Median reach 4.3%; worst 4.7%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| ThemeToggle.toggle@27:18 (p3; B) | ThemeToggle.dark@19:34 | ThemeToggle.dark@19:34 | 5/256 (2.0%) | 254 | 5 |
| SearchBox.edit@41:16 (p8; B) | SearchBox.query@40:36 | SearchBox.query@40:36, SearchBox.results@44:26 | 12/256 (4.7%) | 773 | 108 |
| LikeButton.add@109:15 (p90; B) | LikeButton.optimistic@106:46, LikeButton.pending@107:40, LikeButton.failure@108:40, LikeButton.count@105:36 | LikeButton.count@105:36, LikeButton.pending@107:40, LikeButton.optimistic@106:46, LikeButton.failure@108:40 | 11/256 (4.3%) | 1,059 | 47 |
| LikeButton.add@109:15 (p157; B) | LikeButton.optimistic@106:46, LikeButton.pending@107:40, LikeButton.failure@108:40, LikeButton.count@105:36 | LikeButton.count@105:36, LikeButton.pending@107:40, LikeButton.optimistic@106:46, LikeButton.failure@108:40 | 11/256 (4.3%) | 1,059 | 44 |
| NewsletterForm.edit@147:16 (p169; B) | NewsletterForm.email@143:36 | NewsletterForm.email@143:36 | 3/256 (1.2%) | 111 | 2 |
| NewsletterForm.submit@150:18 (p170; B) | NewsletterForm.pending@146:40, NewsletterForm.failure@145:40, NewsletterForm.message@144:40 | NewsletterForm.email@143:36, NewsletterForm.pending@146:40, NewsletterForm.message@144:40, NewsletterForm.failure@145:40 | 11/256 (4.3%) | 1,031 | 57 |
| ImageCarousel.next@250:16 (p190; B) | ImageCarousel.index@249:36 | ImageCarousel.index@249:36 | 5/256 (2.0%) | 253 | 297 |

Worst events: SearchBox.edit@41:16 (12 parts; SearchBox.query@40:36, SearchBox.results@44:26); LikeButton.add@109:15 (11 parts; LikeButton.optimistic@106:46, LikeButton.pending@107:40, LikeButton.failure@108:40, LikeButton.count@105:36); LikeButton.add@109:15 (11 parts; LikeButton.optimistic@106:46, LikeButton.pending@107:40, LikeButton.failure@108:40, LikeButton.count@105:36).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 584,641 | 642,511 | 0 | 0 | 348,751 | 348,751 |
| load / (pending) | idle / SSR settled | — | 1,841 | 1,841 | 0 | 0 | 0 | 1,841 |
| content loads | idle / SSR settled | — | 1,841 | 1,841 | 0 | 0 | 0 | 1,841 |
| comment list loads, avatars pending | idle / SSR settled | — | 1,841 | 1,841 | 0 | 0 | 0 | 1,841 |
| avatars load | idle / SSR settled | — | 1,841 | 1,841 | 0 | 0 | 0 | 1,841 |
| navigate to /docs/start | c:DocPage, s:ArticleContent.article#2 | 7, 8 | 238,733 | 239,118 | 3,859 | 3,859 | 3,859 | 5,700 |
| article loads | s:ArticleContent.article#2 | — | 129,679 | 130,233 | 3,480 | 0 | 0 | 5,321 |
| toggle theme | e:ThemeToggle.toggle | 1 | 86,684 | 86,677 | 254 | 254 | 254 | 2,095 |
| search starts | e:SearchBox.edit | 2 | 95,766 | 95,759 | 773 | 773 | 773 | 2,614 |
| search results | s:SearchBox.results | — | 121,873 | 122,425 | 669 | 0 | 0 | 2,510 |
| like (optimistic) | e:LikeButton.add#2 | — | 91,028 | 92,197 | 1,059 | 621 | 621 | 2,900 |
| like saved | e:LikeButton.add#2 | — | 97,553 | 98,138 | 1,059 | 0 | 0 | 2,900 |
| second like (optimistic) | e:LikeButton.add#2 | — | 91,178 | 92,347 | 1,059 | 0 | 0 | 2,900 |
| like rate limited | e:LikeButton.add#2 | — | 97,295 | 97,880 | 1,059 | 0 | 0 | 2,900 |
| newsletter good email | e:NewsletterForm.edit | 9 | 80,100 | 80,091 | 460 | 460 | 460 | 2,301 |
| newsletter in flight | e:NewsletterForm.submit | — | 88,623 | 88,612 | 1,031 | 623 | 623 | 2,872 |
| newsletter success | e:NewsletterForm.submit | — | 96,508 | 97,311 | 1,031 | 0 | 0 | 2,872 |
| newsletter bad email | e:NewsletterForm.edit | — | 82,669 | 82,660 | 111 | 0 | 0 | 1,952 |
| bad newsletter in flight | e:NewsletterForm.submit | — | 88,661 | 88,650 | 1,031 | 0 | 0 | 2,872 |
| newsletter typed error | e:NewsletterForm.submit | — | 98,298 | 98,874 | 1,031 | 0 | 0 | 2,872 |
| carousel next | e:ImageCarousel.next | 11 | 85,232 | 85,221 | 253 | 253 | 253 | 2,094 |
| search failure starts | e:SearchBox.edit | — | 95,899 | 95,892 | 773 | 0 | 0 | 2,614 |
| search typed error | s:SearchBox.results | — | 113,060 | 113,929 | 669 | 0 | 0 | 2,510 |
| navigate to failing slug | c:DocPage, s:ArticleContent.article#2 | — | 167,718 | 167,763 | 3,859 | 0 | 0 | 5,700 |
| not-found typed error | s:ArticleContent.article#2 | — | 135,935 | 136,784 | 3,480 | 0 | 0 | 5,321 |
| **Total** | | | **2,774,497** | 2,840,436 | 27,000 | 6,843 | **355,594** | **419,935** |

### effect-yield

C1b materialization groups: 1. Median reach 19.2%; worst 75.8%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| App.append@26:18 (p2) | App.entries@25:40 | App.entries@25:40, LogPanel.newestFirst@26:30 | 11/99 (11.1%) | 570 | 4 |
| App.clear@32:17 (p3) | App.entries@25:40 | App.entries@25:40, LogPanel.newestFirst@26:30 | 11/99 (11.1%) | 500 | 4 |
| App.showTypeahead@81:25 (p5; B) | App.tab@80:32 | App.tab@80:32, Typeahead.query@94:36, Typeahead.results@99:26, Checkout.cart@123:34, Checkout.phase@135:36, Checkout.inFlight@187:27, Checkout.total@140:24, Checkout.declineCard@138:48, Checkout.state@297:38, Checkout.notice@137:38, Checkout.orders@126:27 | 65/99 (65.7%) | 7,757 | 4,652 |
| App.showCheckout@84:24 (p6; B) | App.tab@80:32 | App.tab@80:32, Typeahead.query@94:36, Typeahead.results@99:26, Checkout.cart@123:34, Checkout.phase@135:36, Checkout.inFlight@187:27, Checkout.total@140:24, Checkout.declineCard@138:48, Checkout.state@297:38, Checkout.notice@137:38, Checkout.orders@126:27 | 65/99 (65.7%) | 7,756 | 4,652 |
| Typeahead.onInput@108:19 (p16; B) | Typeahead.query@94:36 | Typeahead.query@94:36, Typeahead.results@99:26, Checkout.total@140:24, Checkout.cart@123:34 | 24/99 (24.2%) | 4,875 | 4,386 |
| Typeahead.reset@147:45 (p33; B) | — | Typeahead.results@99:26, Typeahead.query@94:36, Checkout.total@140:24, Checkout.cart@123:34 | 24/99 (24.2%) | 4,812 | 4,386 |
| Checkout.base@164:16 (p41) | Checkout.notice@137:38, Checkout.phase@135:36, Checkout.orders@126:27 | Checkout.phase@135:36, Checkout.inFlight@187:27, Checkout.cart@123:34, Checkout.state@297:38, Checkout.notice@137:38, Checkout.orders@126:27, Checkout.total@140:24, Typeahead.results@99:26, Typeahead.query@94:36 | 38/99 (38.4%) | 11,991 | 4,512 |
| Checkout.place@190:17 (p43; B) | Checkout.notice@137:38, Checkout.phase@135:36, Checkout.orders@126:27 | Checkout.cart@123:34, Checkout.declineCard@138:48, Checkout.phase@135:36, Checkout.inFlight@187:27, Checkout.state@297:38, Checkout.notice@137:38, Checkout.orders@126:27, Checkout.total@140:24, Typeahead.results@99:26, Typeahead.query@94:36 | 40/99 (40.4%) | 12,323 | 4,517 |
| Checkout.cancel@199:18 (p44; B) | — | — | 1/99 (1.0%) | 46 | 0 |
| Checkout.toggleDecline@202:25 (p45; B) | Checkout.declineCard@138:48 | Checkout.declineCard@138:48 | 3/99 (3.0%) | 118 | 5 |
| Checkout.decrement@223:35 (p48; B) | Checkout.cart@123:34 | Checkout.cart@123:34, Checkout.inFlight@187:27, Checkout.total@140:24, Checkout.phase@135:36 | 14/99 (14.1%) | 894 | 479 |
| Checkout.increment@229:35 (p49; B) | Checkout.cart@123:34 | Checkout.cart@123:34, Checkout.inFlight@187:27, Checkout.total@140:24, Checkout.phase@135:36 | 14/99 (14.1%) | 894 | 479 |
| LogPanel.clear@29:17 (p87; B) | App.entries@25:40 | App.entries@25:40, LogPanel.newestFirst@26:30 | 12/99 (12.1%) | 557 | 4 |
| App.reset@95:33 (p98; B) | — | App.tab@80:32, Typeahead.query@94:36, Typeahead.results@99:26, Checkout.cart@123:34, Checkout.phase@135:36, Checkout.inFlight@187:27, Checkout.total@140:24, Checkout.declineCard@138:48, Checkout.state@297:38, Checkout.notice@137:38, Checkout.orders@126:27, App.entries@25:40, LogPanel.newestFirst@26:30 | 75/99 (75.8%) | 8,124 | 4,656 |

Worst events: App.reset@95:33 (75 parts; App.tab@80:32, Typeahead.query@94:36, Typeahead.results@99:26, Checkout.cart@123:34, Checkout.phase@135:36, Checkout.inFlight@187:27, Checkout.total@140:24, Checkout.declineCard@138:48, Checkout.state@297:38, Checkout.notice@137:38, Checkout.orders@126:27, App.entries@25:40, LogPanel.newestFirst@26:30); App.showTypeahead@81:25 (65 parts; App.tab@80:32); App.showCheckout@84:24 (65 parts; App.tab@80:32).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 2,484,052 | — | 0 | 0 | 348,751 | 348,751 |
| mount | idle / SSR settled | — | 1,703 | — | 0 | 0 | 0 | 1,841 |
| type s | e:Typeahead.onInput, e:App.append | 1 | 288,992 | — | 8,268 | 8,268 | 8,268 | 10,109 |
| type so before s lands (supersedes the s flight) | e:Typeahead.onInput, e:App.append | — | 242,011 | — | 5,445 | 0 | 0 | 7,286 |
| so lands | s:Typeahead.results, e:App.append | — | 252,713 | — | 5,267 | 0 | 0 | 7,108 |
| type sol (stale while revalidating) | e:Typeahead.onInput, e:App.append | — | 239,376 | — | 5,445 | 0 | 0 | 7,286 |
| halfway | idle / SSR settled | — | 1,703 | — | 0 | 0 | 0 | 1,841 |
| sol lands | s:Typeahead.results, e:App.append | — | 242,352 | — | 5,267 | 0 | 0 | 7,108 |
| type zzz | e:Typeahead.onInput, e:App.append | — | 238,501 | — | 5,445 | 0 | 0 | 7,286 |
| zzz lands (no matches) | s:Typeahead.results, e:App.append | — | 250,841 | — | 5,267 | 0 | 0 | 7,108 |
| clear the query | e:Typeahead.onInput, e:App.append | — | 114,726 | — | 5,445 | 0 | 0 | 7,286 |
| flaky network: every attempt fails | e:Typeahead.onInput, e:App.append | — | 269,228 | — | 5,445 | 0 | 0 | 7,286 |
| retries back off | s:Typeahead.results, e:App.append | — | 177,104 | — | 5,267 | 0 | 0 | 7,108 |
| retries give up | s:Typeahead.results, e:App.append | — | 298,447 | — | 5,267 | 0 | 0 | 7,108 |
| network recovers, try again | e:Typeahead.reset, e:App.append | — | 240,881 | — | 5,382 | 0 | 0 | 7,223 |
| vite lands | s:Typeahead.results, e:App.append | — | 252,248 | — | 5,267 | 0 | 0 | 7,108 |
| clear the log | e:LogPanel.clear | — | 122,860 | — | 557 | 140 | 140 | 2,398 |
| open the checkout tab | e:App.showCheckout | — | 227,471 | — | 7,756 | 121 | 121 | 9,597 |
| orders load | s:Checkout.orders | — | 141,569 | — | 5,069 | 0 | 0 | 6,910 |
| increment the first item | e:Checkout.increment | — | 120,091 | — | 894 | 149 | 149 | 2,735 |
| decrement the second item | e:Checkout.decrement | — | 118,647 | — | 894 | 149 | 149 | 2,735 |
| place an order | e:Checkout.place, e:App.append | — | 199,802 | — | 12,893 | 6,121 | 6,121 | 14,734 |
| reserving done, charging | e:Checkout.place, e:App.append | — | 184,677 | — | 12,893 | 0 | 0 | 14,734 |
| charging done, finalizing | e:Checkout.place, e:App.append | — | 184,462 | — | 12,893 | 0 | 0 | 14,734 |
| order created | e:Checkout.place, e:App.append | — | 208,498 | — | 12,893 | 0 | 0 | 14,734 |
| orders refresh | s:Checkout.orders | — | 201,703 | — | 5,069 | 0 | 0 | 6,910 |
| tick decline | e:Checkout.toggleDecline | — | 77,533 | — | 118 | 71 | 71 | 1,959 |
| place a declined order | e:Checkout.place, e:App.append | — | 196,753 | — | 12,893 | 0 | 0 | 14,734 |
| charge declines | e:Checkout.place, e:App.append | — | 192,000 | — | 12,893 | 0 | 0 | 14,734 |
| compensations run | e:Checkout.place, e:App.append | — | 183,125 | — | 12,893 | 0 | 0 | 14,734 |
| untick decline | e:Checkout.toggleDecline | — | 77,293 | — | 118 | 0 | 0 | 1,959 |
| place an order to cancel | e:Checkout.place, e:App.append | — | 196,562 | — | 12,893 | 0 | 0 | 14,734 |
| mid-charge | e:Checkout.place, e:App.append | — | 183,799 | — | 12,893 | 0 | 0 | 14,734 |
| cancel | e:Checkout.cancel, e:Checkout.base, e:App.append | — | 191,048 | — | 12,607 | 46 | 46 | 14,448 |
| compensations after cancel | e:Checkout.place, e:App.append | — | 182,526 | — | 12,893 | 0 | 0 | 14,734 |
| back to the typeahead tab (fresh component) | e:App.showTypeahead | — | 121,050 | — | 7,757 | 50 | 50 | 9,598 |
| settle | idle / SSR settled | — | 1,703 | — | 0 | 0 | 0 | 1,841 |
| **Total** | | | **8,908,050** | — | 242,246 | 15,115 | **363,866** | **657,273** |

### hackernews-spa-yield

C1b materialization groups: 4. Median reach 6.7%; worst 6.7%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| Toggle.toggle@7:18 (p56; B) | Toggle.open@6:34 | Toggle.open@6:34 | 5/75 (6.7%) | 430 | 4 |

Worst events: Toggle.toggle@7:18 (5 parts; Toggle.open@6:34).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 541,596 | — | 0 | 0 | 348,751 | 348,751 |
| mount / (loading, then the top feed) | s:Stories.page, s:Stories.type, s:Stories.stories | 2 | 129,210 | — | 2,163 | 2,163 | 2,163 | 4,004 |
| next page | s:Stories.page, s:Stories.type, s:Stories.stories | — | 239,148 | — | 2,163 | 0 | 0 | 4,004 |
| previous page | s:Stories.page, s:Stories.type, s:Stories.stories | — | 230,422 | — | 2,163 | 0 | 0 | 4,004 |
| New | s:Stories.page, s:Stories.type, s:Stories.stories | — | 236,759 | — | 2,163 | 0 | 0 | 4,004 |
| Ask | s:Stories.page, s:Stories.type, s:Stories.stories | — | 237,086 | — | 2,163 | 0 | 0 | 4,004 |
| Jobs | s:Stories.page, s:Stories.type, s:Stories.stories | — | 235,430 | — | 2,163 | 0 | 0 | 4,004 |
| a job's story | s:Story.story | 3 | 250,569 | — | 1,731 | 1,731 | 1,731 | 3,572 |
| collapse the first thread | e:Toggle.toggle | — | 79,941 | — | 430 | 49 | 49 | 2,271 |
| expand it | e:Toggle.toggle | — | 80,043 | — | 430 | 0 | 0 | 2,271 |
| collapse the nested reply | e:Toggle.toggle | — | 79,941 | — | 430 | 0 | 0 | 2,271 |
| a commenter | s:User.user | 4 | 238,409 | — | 746 | 746 | 746 | 2,587 |
| Show | s:Stories.page, s:Stories.type, s:Stories.stories | — | 249,689 | — | 2,163 | 0 | 0 | 4,004 |
| Show page 2 (last page) | s:Stories.page, s:Stories.type, s:Stories.stories | — | 232,366 | — | 2,163 | 0 | 0 | 4,004 |
| a story's author | s:User.user | — | 238,747 | — | 746 | 0 | 0 | 2,587 |
| home | s:Stories.page, s:Stories.type, s:Stories.stories | — | 245,068 | — | 2,163 | 0 | 0 | 4,004 |
| **Total** | | | **3,544,424** | — | 23,980 | 4,689 | **353,440** | **400,346** |

### rendering-yield

C1b materialization groups: 1. Median reach 10.6%; worst 76.5%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| Router.event@50:27 (p4) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,639 | 822 |
| Link.navigate@91:20 (p6; B) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,719 | 824 |
| Link.navigate@91:20 (p10; B) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,719 | 831 |
| Link.navigate@91:20 (p14; B) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,719 | 832 |
| Link.navigate@91:20 (p18; B) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,719 | 830 |
| Link.navigate@91:20 (p22; B) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,719 | 836 |
| Link.navigate@91:20 (p26; B) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,719 | 830 |
| Link.navigate@91:20 (p30; B) | Router.navigated@41:45, Home.s@4:27 | Router.navigated@41:45, Router.location@42:29, Home.s@4:27, ProfilePage.user@9:23, ProfilePage.info@21:23, Settings.text@8:34, Settings.modalClicks@10:48, Settings.modalOpen@9:44, Stream.memoItems@101:28, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34, InnerBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34, OuterBoundaryItem.item@43:23, RevealPage.seed@87:34, RevealPage.order@85:36, RevealPage.collapsed@86:44, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, Skeleton.version@88:40, Skeleton.feed@92:23 | 166/217 (76.5%) | 8,719 | 832 |
| Home.tick@9:16 (p38) | Home.s@4:27 | Home.s@4:27 | 3/217 (1.4%) | 91 | 1 |
| Settings.count@14:17 (p57; B) | Settings.modalClicks@10:48 | Settings.modalClicks@10:48, Settings.modalOpen@9:44 | 4/217 (1.8%) | 131 | 5 |
| Settings.input@17:17 (p58; B) | Settings.text@8:34 | Settings.text@8:34 | 4/217 (1.8%) | 145 | 4 |
| Settings.open@20:16 (p59; B) | Settings.modalOpen@9:44 | Settings.modalOpen@9:44 | 3/217 (1.4%) | 859 | 4 |
| Settings.close@23:17 (p60; B) | Settings.modalOpen@9:44 | Settings.modalOpen@9:44 | 3/217 (1.4%) | 860 | 4 |
| InnerBoundaryItem.retry@66:19 (p93; B) | InnerBoundaryItem.chosen@42:34 | InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34 | 23/217 (10.6%) | 749 | 33 |
| InnerBoundaryItem.retry@66:19 (p101; B) | InnerBoundaryItem.chosen@42:34 | InnerBoundaryItem.item@43:23, InnerBoundaryItem.chosen@42:34 | 23/217 (10.6%) | 749 | 40 |
| OuterBoundaryItem.retry@66:19 (p109; B) | OuterBoundaryItem.chosen@42:34 | OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34 | 23/217 (10.6%) | 749 | 33 |
| OuterBoundaryItem.retry@66:19 (p117; B) | OuterBoundaryItem.chosen@42:34 | OuterBoundaryItem.item@43:23, OuterBoundaryItem.chosen@42:34 | 23/217 (10.6%) | 749 | 40 |
| RevealPage.collapse@93:20 (p125; B) | RevealPage.collapsed@86:44 | RevealPage.collapsed@86:44 | 3/217 (1.4%) | 125 | 4 |
| RevealPage.restart@96:19 (p126; B) | RevealPage.seed@87:34 | RevealPage.seed@87:34, RevealPage.order@85:36, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24, AsyncCard.value@42:24 | 59/217 (27.2%) | 821 | 146 |
| RevealPage.event@90:5 (p131; B) | RevealPage.order@85:36 | RevealPage.order@85:36 | 8/217 (3.7%) | 451 | 12 |
| RevealPage.event@90:5 (p134; B) | RevealPage.order@85:36 | RevealPage.order@85:36 | 8/217 (3.7%) | 451 | 12 |
| RevealPage.event@90:5 (p137; B) | RevealPage.order@85:36 | RevealPage.order@85:36 | 8/217 (3.7%) | 451 | 12 |
| Skeleton.refetch@121:19 (p201; B) | Skeleton.version@88:40 | Skeleton.version@88:40, Skeleton.feed@92:23 | 27/217 (12.4%) | 1,529 | 195 |

Worst events: Router.event@50:27 (166 parts; Router.navigated@41:45, Router.location@42:29, Home.s@4:27); Link.navigate@91:20 (166 parts; Router.navigated@41:45, Router.location@42:29, Home.s@4:27); Link.navigate@91:20 (166 parts; Router.navigated@41:45, Router.location@42:29, Home.s@4:27).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 405,176 | — | 0 | 0 | 348,751 | 348,751 |
| mount (Home, lazy) | !effects, c:Home | 1 | 112,312 | — | 7,970 | 7,970 | 7,970 | 9,811 |
| Home ticks | e:Home.tick | — | 74,946 | — | 91 | 0 | 0 | 1,932 |
| Profile | e:Link.navigate | — | 210,386 | — | 8,719 | 749 | 749 | 10,560 |
| profile data | s:ProfilePage.user, s:ProfilePage.info | — | 110,642 | — | 915 | 0 | 0 | 2,756 |
| Settings | e:Link.navigate | — | 192,093 | — | 8,719 | 0 | 0 | 10,560 |
| type | e:Settings.input | — | 77,905 | — | 145 | 62 | 62 | 1,986 |
| logical click inside the portal | e:Settings.count | — | 79,938 | — | 131 | 81 | 81 | 1,972 |
| close the portal | e:Settings.close | — | 96,587 | — | 860 | 50 | 50 | 2,701 |
| click the section (modal closed: not counted) | e:Settings.count | — | 31,600 | — | 131 | 0 | 0 | 1,972 |
| reopen the portal | e:Settings.open | — | 104,332 | — | 859 | 49 | 49 | 2,700 |
| close again | e:Settings.close | — | 97,768 | — | 860 | 0 | 0 | 2,701 |
| Stream | e:Link.navigate | — | 222,327 | — | 8,719 | 0 | 0 | 10,560 |
| two items | s:Stream.memoItems, s:Stream.cell | — | 155,538 | — | 1,207 | 0 | 0 | 3,048 |
| all items | s:Stream.memoItems, s:Stream.cell | — | 148,132 | — | 1,207 | 0 | 0 | 3,048 |
| Error Stream | e:Link.navigate | — | 208,317 | — | 8,719 | 0 | 0 | 10,560 |
| items settle / fail | s:InnerBoundaryItem.item, s:OuterBoundaryItem.item | — | 126,399 | — | 632 | 0 | 0 | 2,473 |
| reset the inner bad item | e:InnerBoundaryItem.retry#2 | — | 143,518 | — | 749 | 60 | 60 | 2,590 |
| reset the outer bad item | e:OuterBoundaryItem.retry#2 | — | 143,944 | — | 749 | 0 | 0 | 2,590 |
| Reveal | e:Link.navigate | — | 226,343 | — | 8,719 | 0 | 0 | 10,560 |
| cards reveal (sequential) | s:AsyncCard.value | — | 122,615 | — | 519 | 0 | 0 | 2,360 |
| order: natural, restart | e:RevealPage.event, e:RevealPage.restart, s:AsyncCard.value | — | 175,191 | — | 1,135 | 98 | 98 | 2,976 |
| natural settles | s:AsyncCard.value | — | 112,820 | — | 519 | 0 | 0 | 2,360 |
| uncollapse (sequential) | e:RevealPage.event, e:RevealPage.collapse, e:RevealPage.restart, s:AsyncCard.value | — | 176,751 | — | 1,260 | 69 | 69 | 3,101 |
| Skeleton | e:Link.navigate | — | 231,302 | — | 8,719 | 0 | 0 | 10,560 |
| feed lands | s:Skeleton.feed, s:Skeleton.cell | — | 161,724 | — | 1,474 | 0 | 0 | 3,315 |
| refetch (pending) | e:Skeleton.refetch | — | 129,935 | — | 1,529 | 55 | 55 | 3,370 |
| refetched | s:Skeleton.feed, s:Skeleton.cell | — | 196,317 | — | 1,474 | 0 | 0 | 3,315 |
| Home again | e:Link.navigate | — | 143,398 | — | 8,719 | 0 | 0 | 10,560 |
| popstate back | e:Router.event | — | 147,086 | — | 8,639 | 96 | 96 | 10,480 |
| **Total** | | | **4,565,342** | — | 94,088 | 9,339 | **358,090** | **496,228** |

### room-yield

C1b materialization groups: 2. Median reach 7.4%; worst 18.9%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| Header.report@27:18 (p8) | Header.status@23:38, Header.deaths@24:38, Header.error@25:36 | Header.deaths@24:38, Header.status@23:38, Header.error@25:36 | 8/122 (6.6%) | 615 | 22 |
| Chaos.drop@223:16 (p29; B) | Chaos.last@222:34 | Chaos.last@222:34 | 5/122 (4.1%) | 520 | 23 |
| Chat.report@27:18 (p37) | Chat.status@23:38, Chat.deaths@24:38, Chat.error@25:36 | Chat.deaths@24:38, Chat.status@23:38, Chat.error@25:36 | 9/122 (7.4%) | 736 | 22 |
| Chat.post@278:16 (p41) | Chat.error@277:36, Chat.sending@276:40, Chat.store@266:41 | Chat.store@266:41, IdentityProvider.me@54:30, Live.room@65:23, Chat.sending@276:40, Chat.error@277:36 | 20/122 (16.4%) | 2,502 | 225 |
| Composer.submit@396:18 (p55; B) | Composer.text@394:34, Chat.error@277:36, Chat.sending@276:40, Chat.store@266:41 | Composer.text@394:34, Chat.store@266:41, IdentityProvider.me@54:30, Live.room@65:23, Chat.sending@276:40, Chat.error@277:36 | 23/122 (18.9%) | 2,726 | 227 |
| Composer.input@405:17 (p56; B) | Composer.text@394:34 | Composer.text@394:34 | 3/122 (2.5%) | 110 | 2 |
| DirectoryEntry.report@27:18 (p72) | DirectoryEntry.status@23:38, DirectoryEntry.deaths@24:38, DirectoryEntry.error@25:36 | DirectoryEntry.deaths@24:38, DirectoryEntry.status@23:38 | 6/122 (4.9%) | 347 | 22 |
| Card.report@27:18 (p84) | Card.status@23:38, Card.deaths@24:38, Card.error@25:36 | Card.deaths@24:38, Card.status@23:38, Card.error@25:36 | 9/122 (7.4%) | 736 | 22 |
| Summary.regenerate@665:22 (p108; B) | Summary.attemptNo@664:42 | Summary.attemptNo@664:42, Live.room@65:23, SummaryText.text@719:23 | 10/122 (8.2%) | 606 | 77 |

Worst events: Composer.submit@396:18 (23 parts; Composer.text@394:34, Chat.error@277:36, Chat.sending@276:40, Chat.store@266:41); Chat.post@278:16 (20 parts; Chat.error@277:36, Chat.sending@276:40, Chat.store@266:41); Summary.regenerate@665:22 (10 parts; Summary.attemptNo@664:42, SummaryText.text@719:23).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 637,159 | — | 0 | 0 | 348,751 | 348,751 |
| mount /live | !effects | 1 | 214,881 | — | 6,149 | 6,149 | 6,149 | 7,990 |
| shell sources land | s:Header.who, s:Chat.store, s:DirectoryEntry.who, s:Card.card, s:SummaryText.text, !reports | — | 1,703 | — | 4,874 | 226 | 226 | 6,715 |
| the card's members land | s:Card.members | — | 117,705 | — | 974 | 0 | 0 | 2,815 |
| the activity samples | s:Card.activity, s:SummaryText.text | — | 120,285 | — | 1,523 | 0 | 0 | 3,364 |
| post on /live (optimistic, held for the echo) | e:Composer.input, e:Composer.submit | — | 253,414 | — | 2,788 | 1,185 | 1,185 | 4,629 |
| the echo lands | s:Chat.store, e:Chat.post | — | 1,703 | — | 2,502 | 0 | 0 | 4,343 |
| the summary is streaming | s:SummaryText.text, s:Card.activity | — | 129,211 | — | 1,523 | 0 | 0 | 3,364 |
| kill every connection (the summary dies) | e:Chaos.drop, !reports, s:SummaryText.text | — | 216,197 | — | 1,910 | 457 | 457 | 3,751 |
| live sources reconnect | s:Header.who, s:Chat.store, s:DirectoryEntry.who, s:Card.card, s:SummaryText.text, !reports | — | 1,703 | — | 4,874 | 0 | 0 | 6,715 |
| regenerate the summary | e:Summary.regenerate | — | 144,260 | — | 606 | 73 | 73 | 2,447 |
| the summary and the archive finish | s:SummaryText.text, s:Archive.stats, s:Card.activity | — | 130,974 | — | 1,922 | 0 | 0 | 3,763 |
| switch to #infra from the directory | s:Live.room, c:Live | — | 300,011 | — | 5,780 | 136 | 136 | 7,621 |
| #infra lands | s:Header.who, s:Chat.store, s:DirectoryEntry.who, s:Card.card, s:SummaryText.text, !reports, s:Card.members, s:Card.activity, s:Archive.stats | — | 127,560 | — | 5,273 | 0 | 0 | 7,114 |
| **Total** | | | **2,396,766** | — | 40,698 | 8,226 | **356,977** | **413,382** |

### sierpinski-yield

C1b materialization groups: 1. Median reach 31.3%; worst 33.3%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| TriangleDemo.tick@59:16 (p4) | TriangleDemo.seconds@53:40 | TriangleDemo.seconds@53:40, Triangle.slowChildren@128:31, Dot.hover@251:36 | 7/24 (29.2%) | 657 | 7 |
| TriangleDemo.update@65:18 (p6) | TriangleDemo.elapsed@52:40 | TriangleDemo.elapsed@52:40, TriangleDemo.scale@54:24 | 4/24 (16.7%) | 408 | 2 |
| Dot.onEnter@252:19 (p16; B) | Dot.hover@251:36 | Dot.hover@251:36, TriangleDemo.seconds@53:40, Triangle.slowChildren@128:31 | 8/24 (33.3%) | 1,860 | 7 |
| Dot.onExit@255:18 (p17; B) | Dot.hover@251:36 | Dot.hover@251:36, TriangleDemo.seconds@53:40, Triangle.slowChildren@128:31 | 8/24 (33.3%) | 1,861 | 7 |

Worst events: Dot.onEnter@252:19 (8 parts; Dot.hover@251:36); Dot.onExit@255:18 (8 parts; Dot.hover@251:36); TriangleDemo.tick@59:16 (7 parts; TriangleDemo.seconds@53:40, Triangle.slowChildren@128:31).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 412,251 | — | 0 | 0 | 348,751 | 348,751 |
| mount | !timers | 1 | 1,703 | — | 2,283 | 2,283 | 2,283 | 4,124 |
| idle callbacks resolve | e:TriangleDemo.update, s:Triangle.slowChildren | — | 129,423 | — | 1,005 | 0 | 0 | 2,846 |
| one second: seconds = 1, frames scale the container | e:TriangleDemo.update, s:Triangle.slowChildren, e:TriangleDemo.tick | — | 127,269 | — | 1,065 | 0 | 0 | 2,906 |
| idle callbacks for the new seconds | e:TriangleDemo.update, s:Triangle.slowChildren | — | 78,634 | — | 1,005 | 0 | 0 | 2,846 |
| hover the first dot | e:Dot.onEnter | — | 86,703 | — | 1,860 | 45 | 45 | 3,701 |
| hover the last dot | e:Dot.onEnter | — | 86,789 | — | 1,860 | 0 | 0 | 3,701 |
| leave the first dot | e:Dot.onExit | — | 86,778 | — | 1,861 | 46 | 46 | 3,702 |
| four more seconds | e:TriangleDemo.update, s:Triangle.slowChildren, e:TriangleDemo.tick | — | 128,956 | — | 1,065 | 0 | 0 | 2,906 |
| settle | e:TriangleDemo.update, s:Triangle.slowChildren | — | 78,639 | — | 1,005 | 0 | 0 | 2,846 |
| eight more seconds (seconds wrap past 10) | e:TriangleDemo.update, s:Triangle.slowChildren, e:TriangleDemo.tick | — | 128,425 | — | 1,065 | 0 | 0 | 2,906 |
| settle again | e:TriangleDemo.update, s:Triangle.slowChildren | — | 77,630 | — | 1,005 | 0 | 0 | 2,846 |
| **Total** | | | **1,423,200** | — | 15,079 | 2,374 | **351,125** | **384,081** |

### sierpinski-yield-h

C1b materialization groups: 1. Median reach 39.3%; worst 53.6%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| TriangleDemo.tick@59:16 (p4) | TriangleDemo.seconds@53:40 | TriangleDemo.seconds@53:40, Triangle.slowChildren@159:31, Dot.hover@194:36 | 7/28 (25.0%) | 676 | 7 |
| TriangleDemo.update@65:18 (p6) | TriangleDemo.elapsed@52:40 | TriangleDemo.elapsed@52:40, TriangleDemo.scale@54:24 | 4/28 (14.3%) | 369 | 2 |
| Dot.onEnter@195:19 (p22; B) | Dot.hover@194:36 | Triangle.dotX@116:23, Triangle.dotY@122:23, Dot.hover@194:36, TriangleDemo.seconds@53:40, Triangle.slowChildren@159:31, Triangle.left@146:23, Triangle.right@152:24, Triangle.top@134:22, Triangle.bottom@140:25, Triangle.half@128:23 | 15/28 (53.6%) | 1,592 | 42 |
| Dot.onExit@198:18 (p23; B) | Dot.hover@194:36 | Triangle.dotX@116:23, Triangle.dotY@122:23, Dot.hover@194:36, TriangleDemo.seconds@53:40, Triangle.slowChildren@159:31, Triangle.left@146:23, Triangle.right@152:24, Triangle.top@134:22, Triangle.bottom@140:25, Triangle.half@128:23 | 15/28 (53.6%) | 1,593 | 42 |

Worst events: Dot.onEnter@195:19 (15 parts; Dot.hover@194:36); Dot.onExit@198:18 (15 parts; Dot.hover@194:36); TriangleDemo.tick@59:16 (7 parts; TriangleDemo.seconds@53:40, Triangle.slowChildren@159:31).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 414,130 | — | 0 | 0 | 348,751 | 348,751 |
| mount | !timers | 1 | 1,703 | — | 1,455 | 1,455 | 1,455 | 3,296 |
| idle callbacks resolve | e:TriangleDemo.update, s:Triangle.slowChildren | — | 133,467 | — | 985 | 0 | 0 | 2,826 |
| one second: seconds = 1, frames scale the container | e:TriangleDemo.update, s:Triangle.slowChildren, e:TriangleDemo.tick | — | 131,515 | — | 1,045 | 0 | 0 | 2,886 |
| idle callbacks for the new seconds | e:TriangleDemo.update, s:Triangle.slowChildren | — | 82,147 | — | 985 | 0 | 0 | 2,826 |
| hover the first dot | e:Dot.onEnter | — | 87,121 | — | 1,592 | 566 | 566 | 3,433 |
| hover the last dot | e:Dot.onEnter | — | 87,207 | — | 1,592 | 0 | 0 | 3,433 |
| leave the first dot | e:Dot.onExit | — | 87,212 | — | 1,593 | 46 | 46 | 3,434 |
| four more seconds | e:TriangleDemo.update, s:Triangle.slowChildren, e:TriangleDemo.tick | — | 133,164 | — | 1,045 | 0 | 0 | 2,886 |
| settle | e:TriangleDemo.update, s:Triangle.slowChildren | — | 82,152 | — | 985 | 0 | 0 | 2,826 |
| eight more seconds (seconds wrap past 10) | e:TriangleDemo.update, s:Triangle.slowChildren, e:TriangleDemo.tick | — | 132,671 | — | 1,045 | 0 | 0 | 2,886 |
| settle again | e:TriangleDemo.update, s:Triangle.slowChildren | — | 81,156 | — | 985 | 0 | 0 | 2,826 |
| **Total** | | | **1,453,645** | — | 13,307 | 2,067 | **350,818** | **382,309** |

### todos-yield

C1b materialization groups: 1. Median reach 58.5%; worst 67.9%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| App.onChange@22:20 (p2) | App.filter@21:38 | App.filter@21:38, App.todos@99:36, MainSection.filtered@140:27 | 18/53 (34.0%) | 2,753 | 310 |
| App.addTodo@106:14 (p5) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 30/53 (56.6%) | 4,373 | 322 |
| App.removeTodo@116:17 (p6) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 30/53 (56.6%) | 4,064 | 322 |
| App.toggleTodo@122:17 (p7) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 30/53 (56.6%) | 4,392 | 333 |
| App.toggleAll@134:16 (p8) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 30/53 (56.6%) | 4,586 | 322 |
| App.clearCompleted@157:21 (p9) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 30/53 (56.6%) | 4,299 | 322 |
| App.retryTodo@172:21 (p10) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 35/53 (66.0%) | 7,351 | 349 |
| Header.submit@59:18 (p14; B) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 31/53 (58.5%) | 4,704 | 322 |
| MainSection.toggle@153:18 (p19; B) | App.todos@99:36 | App.todos@99:36, MainSection.allCompleted@150:31, App.filter@21:38, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 31/53 (58.5%) | 4,659 | 322 |
| TodoItem.toggle@86:18 (p26; B) | App.todos@99:36 | App.todos@99:36, MainSection.filtered@140:27, App.filter@21:38, MainSection.allCompleted@150:31, Footer.remaining@199:28, Footer.completed@202:28 | 31/53 (58.5%) | 4,490 | 333 |
| TodoItem.retry@89:17 (p27; B) | App.todos@99:36 | App.todos@99:36, MainSection.filtered@140:27, App.filter@21:38, MainSection.allCompleted@150:31, Footer.remaining@199:28, Footer.completed@202:28 | 36/53 (67.9%) | 7,419 | 349 |
| TodoItem.remove@92:18 (p28; B) | App.todos@99:36 | App.todos@99:36, MainSection.filtered@140:27, App.filter@21:38, MainSection.allCompleted@150:31, Footer.remaining@199:28, Footer.completed@202:28 | 31/53 (58.5%) | 4,136 | 322 |
| Footer.clear@205:17 (p40; B) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 31/53 (58.5%) | 4,355 | 322 |
| App.reset@310:43 (p52; B) | — | Header.s@54:27, App.filter@21:38, App.todos@99:36, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28 | 32/53 (60.4%) | 3,349 | 320 |

Worst events: TodoItem.retry@89:17 (36 parts; App.todos@99:36, MainSection.filtered@140:27, MainSection.allCompleted@150:31, Footer.remaining@199:28, Footer.completed@202:28); App.retryTodo@172:21 (35 parts; App.todos@99:36, MainSection.filtered@140:27, MainSection.allCompleted@150:31, Footer.remaining@199:28, Footer.completed@202:28); App.reset@310:43 (32 parts; Header.s@54:27, App.filter@21:38, App.todos@99:36, MainSection.allCompleted@150:31, MainSection.filtered@140:27, Footer.remaining@199:28, Footer.completed@202:28, Header.ss@55:21).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 438,644 | — | 0 | 0 | 348,751 | 348,751 |
| mount (loading) | !effects | 1 | 1,703 | — | 3,521 | 3,521 | 3,521 | 5,362 |
| todos load | s:App.todos | — | 181,957 | — | 3,310 | 0 | 0 | 5,151 |
| add a todo (optimistic) | e:Header.submit | — | 166,760 | — | 4,704 | 1,394 | 1,394 | 6,545 |
| add settles | e:Header.submit | — | 216,719 | — | 4,704 | 0 | 0 | 6,545 |
| toggle the first | e:TodoItem.toggle | — | 130,298 | — | 4,490 | 866 | 866 | 6,331 |
| toggle settles | e:TodoItem.toggle | — | 213,475 | — | 4,490 | 0 | 0 | 6,331 |
| filter: active | e:App.onChange | — | 113,991 | — | 2,753 | 205 | 205 | 4,594 |
| filter: completed | e:App.onChange | — | 143,051 | — | 2,753 | 0 | 0 | 4,594 |
| filter: all | e:App.onChange | — | 141,947 | — | 2,753 | 0 | 0 | 4,594 |
| toggle all | e:MainSection.toggle | — | 130,932 | — | 4,659 | 1,035 | 1,035 | 6,500 |
| toggle all settles | e:MainSection.toggle | — | 216,523 | — | 4,659 | 0 | 0 | 6,500 |
| toggle all back | e:MainSection.toggle | — | 132,326 | — | 4,659 | 0 | 0 | 6,500 |
| toggle all back settles | e:MainSection.toggle | — | 213,838 | — | 4,659 | 0 | 0 | 6,500 |
| failing save: toggle the second | e:TodoItem.toggle | — | 128,964 | — | 4,490 | 0 | 0 | 6,331 |
| the failure shows a retry | e:TodoItem.toggle | — | 232,556 | — | 4,490 | 0 | 0 | 6,331 |
| retry succeeds | e:TodoItem.retry | — | 130,945 | — | 7,419 | 1,316 | 1,316 | 9,260 |
| retry settles | e:TodoItem.retry | — | 220,797 | — | 7,419 | 0 | 0 | 9,260 |
| failing add | e:Header.submit | — | 165,665 | — | 4,704 | 0 | 0 | 6,545 |
| failed add stays with an error | e:Header.submit | — | 233,162 | — | 4,704 | 0 | 0 | 6,545 |
| retry the add | e:TodoItem.retry | — | 121,875 | — | 7,419 | 0 | 0 | 9,260 |
| retried add settles | e:TodoItem.retry | — | 217,112 | — | 7,419 | 0 | 0 | 9,260 |
| complete the first | e:TodoItem.toggle | — | 126,844 | — | 4,490 | 0 | 0 | 6,331 |
| complete settles | e:TodoItem.toggle | — | 212,689 | — | 4,490 | 0 | 0 | 6,331 |
| clear completed | e:Footer.clear | — | 140,395 | — | 4,355 | 56 | 56 | 6,196 |
| clear settles | e:Footer.clear | — | 213,106 | — | 4,355 | 0 | 0 | 6,196 |
| remove the first | e:TodoItem.remove | — | 140,911 | — | 4,136 | 72 | 72 | 5,977 |
| remove settles | e:TodoItem.remove | — | 213,077 | — | 4,136 | 0 | 0 | 5,977 |
| **Total** | | | **4,940,262** | — | 126,140 | 8,465 | **357,216** | **524,598** |

### todos-yield-h

C1b materialization groups: 1. Median reach 58.2%; worst 69.4%.

| Event (part ID; B = DOM bound) | Writes (signals/stores) | Needed reads | Reached / graph | Code bytes | Data bytes |
| --- | --- | --- | ---: | ---: | ---: |
| App.onChange@22:20 (p2) | App.filter@21:38 | App.filter@21:38, App.todos@99:36, MainSection.filtered@132:27, TodoItem.classes@86:26 | 15/49 (30.6%) | 1,902 | 370 |
| App.addTodo@106:14 (p5) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 28/49 (57.1%) | 3,449 | 390 |
| App.removeTodo@116:17 (p6) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 28/49 (57.1%) | 3,140 | 390 |
| App.toggleTodo@122:17 (p7) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 28/49 (57.1%) | 3,468 | 401 |
| App.toggleAll@134:16 (p8) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 28/49 (57.1%) | 3,662 | 390 |
| App.clearCompleted@157:21 (p9) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 28/49 (57.1%) | 3,375 | 390 |
| App.retryTodo@172:21 (p10) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 33/49 (67.3%) | 6,427 | 417 |
| Header.submit@50:18 (p12; B) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 29/49 (59.2%) | 3,758 | 390 |
| MainSection.toggle@148:18 (p18; B) | App.todos@99:36 | App.todos@99:36, MainSection.allCompleted@142:31, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 29/49 (59.2%) | 3,735 | 390 |
| TodoItem.toggle@77:18 (p21; B) | App.todos@99:36 | App.todos@99:36, MainSection.filtered@132:27, App.filter@21:38, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 29/49 (59.2%) | 3,566 | 401 |
| TodoItem.retry@80:17 (p22; B) | App.todos@99:36 | App.todos@99:36, MainSection.filtered@132:27, App.filter@21:38, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 34/49 (69.4%) | 6,495 | 417 |
| TodoItem.remove@83:18 (p23; B) | App.todos@99:36 | App.todos@99:36, MainSection.filtered@132:27, App.filter@21:38, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 29/49 (59.2%) | 3,212 | 390 |
| Footer.clear@186:17 (p40; B) | App.todos@99:36 | App.todos@99:36, App.filter@21:38, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 29/49 (59.2%) | 3,431 | 390 |
| App.reset@241:12 (p48; B) | — | App.filter@21:38, App.todos@99:36, MainSection.filtered@132:27, TodoItem.classes@86:26, MainSection.hasTodos@145:27, MainSection.allCompleted@142:31, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27 | 28/49 (57.1%) | 2,386 | 386 |

Worst events: TodoItem.retry@80:17 (34 parts; App.todos@99:36, MainSection.filtered@132:27, MainSection.allCompleted@142:31, MainSection.hasTodos@145:27, TodoItem.classes@86:26, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27); App.retryTodo@172:21 (33 parts; App.todos@99:36, MainSection.filtered@132:27, MainSection.allCompleted@142:31, MainSection.hasTodos@145:27, TodoItem.classes@86:26, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27); Header.submit@50:18 (29 parts; App.todos@99:36, MainSection.filtered@132:27, MainSection.allCompleted@142:31, MainSection.hasTodos@145:27, TodoItem.classes@86:26, Footer.remaining@177:28, Footer.completed@180:28, Footer.hasTodos@183:27).

| Phase | Trigger / continuation | New groups | Library measured | Compiled measured | Body spans incl. first materialization | New body bytes | Tier-3 first-use floor | Reset proxy |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | shell + core | — | 444,098 | — | 0 | 0 | 348,751 | 348,751 |
| mount (loading) | !effects | 1 | 1,703 | — | 2,597 | 2,597 | 2,597 | 4,438 |
| todos load | s:App.todos | — | 200,242 | — | 2,386 | 0 | 0 | 4,227 |
| add a todo (optimistic) | e:Header.submit | — | 187,233 | — | 3,758 | 1,372 | 1,372 | 5,599 |
| add settles | e:Header.submit | — | 220,950 | — | 3,758 | 0 | 0 | 5,599 |
| toggle the first | e:TodoItem.toggle | — | 134,459 | — | 3,566 | 866 | 866 | 5,407 |
| toggle settles | e:TodoItem.toggle | — | 218,648 | — | 3,566 | 0 | 0 | 5,407 |
| filter: active | e:App.onChange | — | 147,574 | — | 1,902 | 205 | 205 | 3,743 |
| filter: completed | e:App.onChange | — | 155,473 | — | 1,902 | 0 | 0 | 3,743 |
| filter: all | e:App.onChange | — | 161,047 | — | 1,902 | 0 | 0 | 3,743 |
| toggle all | e:MainSection.toggle | — | 137,786 | — | 3,735 | 1,035 | 1,035 | 5,576 |
| toggle all settles | e:MainSection.toggle | — | 221,608 | — | 3,735 | 0 | 0 | 5,576 |
| toggle all back | e:MainSection.toggle | — | 143,352 | — | 3,735 | 0 | 0 | 5,576 |
| toggle all back settles | e:MainSection.toggle | — | 218,237 | — | 3,735 | 0 | 0 | 5,576 |
| failing save: toggle the second | e:TodoItem.toggle | — | 138,828 | — | 3,566 | 0 | 0 | 5,407 |
| the failure shows a retry | e:TodoItem.toggle | — | 245,658 | — | 3,566 | 0 | 0 | 5,407 |
| retry succeeds | e:TodoItem.retry | — | 140,800 | — | 6,495 | 1,316 | 1,316 | 8,336 |
| retry settles | e:TodoItem.retry | — | 226,315 | — | 6,495 | 0 | 0 | 8,336 |
| failing add | e:Header.submit | — | 184,882 | — | 3,758 | 0 | 0 | 5,599 |
| failed add stays with an error | e:Header.submit | — | 244,875 | — | 3,758 | 0 | 0 | 5,599 |
| retry the add | e:TodoItem.retry | — | 128,752 | — | 6,495 | 0 | 0 | 8,336 |
| retried add settles | e:TodoItem.retry | — | 222,834 | — | 6,495 | 0 | 0 | 8,336 |
| complete the first | e:TodoItem.toggle | — | 130,924 | — | 3,566 | 0 | 0 | 5,407 |
| complete settles | e:TodoItem.toggle | — | 217,764 | — | 3,566 | 0 | 0 | 5,407 |
| clear completed | e:Footer.clear | — | 171,494 | — | 3,431 | 56 | 56 | 5,272 |
| clear settles | e:Footer.clear | — | 213,257 | — | 3,431 | 0 | 0 | 5,272 |
| remove the first | e:TodoItem.remove | — | 170,852 | — | 3,212 | 72 | 72 | 5,053 |
| remove settles | e:TodoItem.remove | — | 213,228 | — | 3,212 | 0 | 0 | 5,053 |
| **Total** | | | **5,242,873** | — | 101,323 | 7,519 | **356,270** | **499,781** |

## Design signals and verdict

Docs' search query reaches its async results, result-row holes and error boundary; LikeButton.add reaches the local count, optimistic, pending and failure displays. Both remain small. Whole-app reset buttons can rebuild their entire boundary; they appear in the worst-event list even if the parity script does not click them. TodoMVC's todos store feeds the filtered rows, completion state and both footer counts. Retrying an unknown action reaches all five action alternatives. Splitting or narrowing that shared store is the app-level signal. Rendering's navigated/location source controls every route alternative; its large reach is a static union, while Reveal's seed recreates all cards. Effect's tab source recreates both panels; the log entries store is shared across actions. Room's post needs the current identity, room and pending transcript, and updates sending/error/transcript readers; connection callbacks and Live.room fan out independently of user clicks. Sierpinski's seconds reaches recursive labels and elapsed drives scale; this is intentionally continuous shared state. Hackernews' open is local to a comment toggle; its row family is widened, while most scripted work is external router navigation.

Tier 3 is worth a narrow docs-only experiment, because the static widget slices are small and the cold empty-shell floor leaves room below eager hydration. It is not yet justified as a general replacement on this corpus. TodoMVC materializes a broad shared-store group on its first useful work; room must start identity and live subscriptions without a user event; Sierpinski is a continuous animation. The very low script floor ratios largely come from counting code once and omitting interaction runtime, so they cannot support a speedup claim. A next experiment should preserve the full phase schedule and measure actual resume/materialization and repeated runtime bytes before expanding beyond docs.

## Reproduce and validation

Validation: pnpm build passed; the full required gate passed 52/52 steps in 86 seconds, with no failures or skips and the existing baseline unchanged. Twelve directed/range fixtures and three existing coverage-counter tests pass. A second empty-root run gave identical core/shell/idle bytes; a second SSR-data extraction gave identical values. Node v24.18.0; installed pnpm v11.20.0 used the existing dependency tree with pnpm_config_pm_on_fail=ignore and pnpm_config_verify_deps_before_run=false to disable automatic version downloads/reinstalls. No dependency manifest or lockfile changed.

```sh
node examples/harness/executed-bytes/empty-root.mjs --record documentation/compiler-reachability-core.json
node examples/harness/executed-bytes/reachability-data.mjs --record documentation/compiler-reachability-data.json
node packages/compiler-yield/src/reachability-report.js --write
node --test packages/compiler-yield/test/reachability.test.mjs
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

The checked-in payload snapshot can be refreshed by running the library docs SSR-only driver and passing the HTML to docsPayload() in reachability-data.js; the HN snapshot comes from the existing deterministic hn-data.mjs fixture. The gate runs this report without thresholds and checks the directed fixtures in compiler:reachability-test. It does not promote a cost estimate into a runtime correctness or performance gate.
