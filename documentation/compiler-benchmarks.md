# Compiler prototype byte measurements

Recorded on Node v24.18.0, Solid rc.13, with the existing parity scripts. The
compiler route is **not built**: the public-API spike failed a delayed root claim
([F-C5](compiler-c2-finding.md)). No compiler savings are claimed.

## What is measured

Executed bytes are the union of V8 precise-coverage source ranges with nonzero
counts, converted from V8's UTF-16 offsets to UTF-8 byte lengths. An unexecuted
nested range removes its bytes from an executed parent. The inspector uses
`Profiler.startPreciseCoverage({callCount: true, detailed: true})` and
`Profiler.takePreciseCoverage`, not a CPU profile. Coverage starts before the
application and runtime imports. `load` ends after the existing driver mounts;
each subsequent checkpoint ends after that named parity step. Taking coverage
resets counts, so a range used in two steps counts in each step.

The scope is app source, Solid packages, the library runtime on the library
route, Effect, and serializer packages. It excludes Node/native code, jsdom,
Vite/Vitest tooling, the harness, test drivers and inline source maps. Modules
run through Vite's module runner under the existing runtime-cost harness's
production conditions. These are **transformed, unbundled source bytes**, not
bytes of the minified production bundle. Module initialization counts; this
metric is neither CPU time nor execution frequency. It cannot be divided by
shipped bytes to obtain an executed fraction. The route-specific drivers are
unchanged; this is their load path, not an SSR-hydration measurement.

Shipped bytes are all production client JS chunks, across all routes, built
with Vite `write:false`. Gzip is the sum of each chunk compressed independently.
CSS, assets and server code are excluded. A dynamically imported chunk counts
as shipped even if the parity script never loads it. The h twins use the same
original as their JSX counterpart.

## Load and shipped bytes

All numbers are bytes. `—` means not built, not zero.

| Twin | Executed load: original | Library | Compiled | Shipped JS: original | Library | Compiled | Gzip: original / library |
| --- | ---: | ---: | --- | ---: | ---: | --- | ---: |
| effect-yield | 2,466,307 | 2,484,052 | — | 241,430 | 256,752 | — | 81,964 / 86,980 |
| hackernews-spa-yield | 1,155,016 | 541,596 | — | 145,771 | 159,690 | — | 51,536 / 55,733 |
| rendering-yield | 385,012 | 405,176 | — | 101,372 | 119,619 | — | 38,004 / 44,143 |
| room-yield | 620,950 | 637,159 | — | 242,516 | 248,206 | — | 82,927 / 84,502 |
| sierpinski-yield | 383,736 | 412,251 | — | 40,452 | 56,361 | — | 15,703 / 21,120 |
| sierpinski-yield-h | 383,736 | 414,130 | — | 40,452 | 69,852 | — | 15,703 / 25,788 |
| todos-yield | 427,338 | 438,644 | — | 89,604 | 104,159 | — | 32,297 / 37,120 |
| todos-yield-h | 427,338 | 444,098 | — | 89,604 | 116,953 | — | 32,297 / 41,434 |

## Executed bytes per parity step

The original and library phases have the same names and order. Small differences
between repeated runs are possible; see the gate allowance below.

### effect-yield

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount | 1,703 | 1,703 | — |
| type s | 272,110 | 288,992 | — |
| type so before s lands (supersedes the s flight) | 231,333 | 242,011 | — |
| so lands | 239,994 | 252,713 | — |
| type sol (stale while revalidating) | 228,902 | 239,376 | — |
| halfway | 1,703 | 1,703 | — |
| sol lands | 231,080 | 242,352 | — |
| type zzz | 228,027 | 238,501 | — |
| zzz lands (no matches) | 239,211 | 250,841 | — |
| clear the query | 103,188 | 114,726 | — |
| flaky network: every attempt fails | 252,489 | 269,228 | — |
| retries back off | 160,178 | 177,104 | — |
| retries give up | 285,795 | 298,447 | — |
| network recovers, try again | 228,639 | 240,881 | — |
| vite lands | 240,583 | 252,248 | — |
| clear the log | 106,596 | 122,860 | — |
| open the checkout tab | 206,353 | 227,471 | — |
| orders load | 126,889 | 141,569 | — |
| increment the first item | 101,858 | 120,091 | — |
| decrement the second item | 100,436 | 118,647 | — |
| place an order | 186,870 | 199,802 | — |
| reserving done, charging | 169,558 | 184,677 | — |
| charging done, finalizing | 169,205 | 184,462 | — |
| order created | 194,267 | 208,498 | — |
| orders refresh | 194,711 | 201,703 | — |
| tick decline | 62,107 | 77,533 | — |
| place a declined order | 185,000 | 196,753 | — |
| charge declines | 176,765 | 192,000 | — |
| compensations run | 171,313 | 183,125 | — |
| untick decline | 62,047 | 77,293 | — |
| place an order to cancel | 184,940 | 196,562 | — |
| mid-charge | 168,879 | 183,799 | — |
| cancel | 168,982 | 191,048 | — |
| compensations after cancel | 170,621 | 182,526 | — |
| back to the typeahead tab (fresh component) | 106,046 | 121,050 | — |
| settle | 1,703 | 1,703 | — |

### hackernews-spa-yield

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount / (loading, then the top feed) | 130,985 | 129,210 | — |
| next page | 231,729 | 239,148 | — |
| previous page | 222,851 | 230,422 | — |
| New | 230,011 | 236,759 | — |
| Ask | 230,267 | 237,086 | — |
| Jobs | 228,943 | 235,430 | — |
| a job's story | 233,557 | 250,569 | — |
| collapse the first thread | 64,711 | 79,941 | — |
| expand it | 64,719 | 80,043 | — |
| collapse the nested reply | 64,711 | 79,941 | — |
| a commenter | 224,827 | 238,409 | — |
| Show | 233,575 | 249,689 | — |
| Show page 2 (last page) | 225,235 | 232,366 | — |
| a story's author | 225,595 | 238,747 | — |
| home | 228,898 | 245,068 | — |

### rendering-yield

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount (Home, lazy) | 118,931 | 112,312 | — |
| Home ticks | 56,218 | 74,946 | — |
| Profile | 197,528 | 210,386 | — |
| profile data | 100,649 | 110,642 | — |
| Settings | 184,393 | 192,093 | — |
| type | 57,576 | 77,905 | — |
| logical click inside the portal | 59,509 | 79,938 | — |
| close the portal | 79,542 | 96,587 | — |
| click the section (modal closed: not counted) | 5,494 | 31,600 | — |
| reopen the portal | 86,071 | 104,332 | — |
| close again | 80,723 | 97,768 | — |
| Stream | 213,345 | 222,327 | — |
| two items | 151,362 | 155,538 | — |
| all items | 142,135 | 148,132 | — |
| Error Stream | 196,335 | 208,317 | — |
| items settle / fail | 118,877 | 126,399 | — |
| reset the inner bad item | 134,600 | 143,518 | — |
| reset the outer bad item | 135,050 | 143,944 | — |
| Reveal | 209,591 | 226,343 | — |
| cards reveal (sequential) | 118,572 | 122,615 | — |
| order: natural, restart | 160,104 | 175,191 | — |
| natural settles | 109,632 | 112,820 | — |
| uncollapse (sequential) | 161,775 | 176,751 | — |
| Skeleton | 218,572 | 231,302 | — |
| feed lands | 155,028 | 161,724 | — |
| refetch (pending) | 124,041 | 129,935 | — |
| refetched | 188,779 | 196,317 | — |
| Home again | 129,365 | 143,398 | — |
| popstate back | 129,116 | 147,086 | — |

### room-yield

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount /live | 201,565 | 214,881 | — |
| shell sources land | 1,703 | 1,703 | — |
| the card's members land | 113,217 | 117,705 | — |
| the activity samples | 99,356 | 120,285 | — |
| post on /live (optimistic, held for the echo) | 245,049 | 253,414 | — |
| the echo lands | 1,703 | 1,703 | — |
| the summary is streaming | 109,055 | 129,211 | — |
| kill every connection (the summary dies) | 200,869 | 216,197 | — |
| live sources reconnect | 1,703 | 1,703 | — |
| regenerate the summary | 137,500 | 144,260 | — |
| the summary and the archive finish | 111,203 | 130,974 | — |
| switch to #infra from the directory | 285,518 | 300,011 | — |
| #infra lands | 107,392 | 127,560 | — |

### sierpinski-yield

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount | 1,703 | 1,703 | — |
| idle callbacks resolve | 119,675 | 129,423 | — |
| one second: seconds = 1, frames scale the container | 121,569 | 127,269 | — |
| idle callbacks for the new seconds | 66,279 | 78,634 | — |
| hover the first dot | 71,926 | 86,703 | — |
| hover the last dot | 72,012 | 86,789 | — |
| leave the first dot | 71,659 | 86,778 | — |
| four more seconds | 123,856 | 128,956 | — |
| settle | 66,284 | 78,639 | — |
| eight more seconds (seconds wrap past 10) | 123,325 | 128,425 | — |
| settle again | 66,032 | 77,630 | — |

### sierpinski-yield-h

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount | 1,703 | 1,703 | — |
| idle callbacks resolve | 119,675 | 133,467 | — |
| one second: seconds = 1, frames scale the container | 121,569 | 131,515 | — |
| idle callbacks for the new seconds | 66,279 | 82,147 | — |
| hover the first dot | 71,926 | 87,121 | — |
| hover the last dot | 72,012 | 87,207 | — |
| leave the first dot | 71,659 | 87,212 | — |
| four more seconds | 123,856 | 133,164 | — |
| settle | 66,284 | 82,152 | — |
| eight more seconds (seconds wrap past 10) | 123,325 | 132,671 | — |
| settle again | 66,032 | 81,156 | — |

### todos-yield

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount (loading) | 1,703 | 1,703 | — |
| todos load | 165,125 | 181,957 | — |
| add a todo (optimistic) | 163,826 | 166,760 | — |
| add settles | 210,726 | 216,719 | — |
| toggle the first | 118,907 | 130,298 | — |
| toggle settles | 207,333 | 213,475 | — |
| filter: active | 109,660 | 113,991 | — |
| filter: completed | 127,127 | 143,051 | — |
| filter: all | 131,202 | 141,947 | — |
| toggle all | 119,419 | 130,932 | — |
| toggle all settles | 207,817 | 216,523 | — |
| toggle all back | 123,878 | 132,326 | — |
| toggle all back settles | 208,148 | 213,838 | — |
| failing save: toggle the second | 118,803 | 128,964 | — |
| the failure shows a retry | 222,682 | 232,556 | — |
| retry succeeds | 121,881 | 130,945 | — |
| retry settles | 215,532 | 220,797 | — |
| failing add | 162,685 | 165,665 | — |
| failed add stays with an error | 224,983 | 233,162 | — |
| retry the add | 115,111 | 121,875 | — |
| retried add settles | 211,548 | 217,112 | — |
| complete the first | 115,818 | 126,844 | — |
| complete settles | 206,869 | 212,689 | — |
| clear completed | 143,301 | 140,395 | — |
| clear settles | 208,807 | 213,106 | — |
| remove the first | 142,163 | 140,911 | — |
| remove settles | 208,716 | 213,077 | — |

### todos-yield-h

| Step | Original | Library | Compiled |
| --- | ---: | ---: | --- |
| mount (loading) | 1,703 | 1,703 | — |
| todos load | 165,125 | 200,242 | — |
| add a todo (optimistic) | 163,826 | 187,233 | — |
| add settles | 210,726 | 220,950 | — |
| toggle the first | 118,907 | 134,459 | — |
| toggle settles | 207,333 | 218,648 | — |
| filter: active | 109,660 | 147,574 | — |
| filter: completed | 127,127 | 155,473 | — |
| filter: all | 131,202 | 161,047 | — |
| toggle all | 119,419 | 137,786 | — |
| toggle all settles | 207,817 | 221,608 | — |
| toggle all back | 123,878 | 143,352 | — |
| toggle all back settles | 208,148 | 218,237 | — |
| failing save: toggle the second | 118,803 | 138,828 | — |
| the failure shows a retry | 222,682 | 245,658 | — |
| retry succeeds | 121,881 | 140,800 | — |
| retry settles | 215,532 | 226,315 | — |
| failing add | 162,685 | 184,882 | — |
| failed add stays with an error | 224,983 | 244,875 | — |
| retry the add | 115,111 | 128,752 | — |
| retried add settles | 211,548 | 222,834 | — |
| complete the first | 115,818 | 130,924 | — |
| complete settles | 206,869 | 217,764 | — |
| clear completed | 143,301 | 171,494 | — |
| clear settles | 208,807 | 213,257 | — |
| remove the first | 142,163 | 170,852 | — |
| remove settles | 208,716 | 213,228 | — |

## Gate and reproduction

`compiler:executed-bytes-test` checks the range counter (nested exclusions, UTF-8
and source-map exclusion). `twins:executed-bytes` measures all 16 original/library
runs and compares every phase to [executed-bytes.json](executed-bytes.json).
Phase names, counts and twin/route inventory must match. The limit is the recorded
value plus the greater of 2% or 1,024 bytes. Decreases pass. This allowance covers
observed same-machine branch variation; it is not evidence of cross-machine
stability. Changes to the Node or Solid version require a reviewed remeasurement.
Wall time is not gated.

```sh
node examples/harness/executed-bytes/measure.mjs --baseline documentation/executed-bytes.json
node examples/harness/executed-bytes/measure.mjs --only todos-yield
# Deliberately record a new reference after reviewing changes:
node examples/harness/executed-bytes/measure.mjs --record documentation/executed-bytes.json
node examples/harness/executed-bytes/shipped.mjs documentation/shipped-bytes.json
```

The runner creates an isolated temporary driver outside each twin's normal test
and TypeScript discovery paths, and removes it in `finally`. No generated driver
or bundle is checked in. [shipped-bytes.json](shipped-bytes.json) records the
production build sizes; shipped size is reported, not an additional threshold.

The larger original Hackernews load count should not be read as a compiler win:
there is no compiler route. This metric includes the different modules and paths
loaded by the existing original and library parity drivers.
