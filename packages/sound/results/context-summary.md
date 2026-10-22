# Context/services baseline summary

Counts are expectation entries (not individual diagnostics); extras count diagnostics.
A grouped entry can require several diagnostics, e.g. eight FailureControls handlers.
Warning misses also count as soundness failures. Analysis is unchanged; only emitter severity-table wiring changed.

| prototype | group | fixtures | errors hit/miss | warnings hit/miss | extra errors/warnings | failing fixtures |
|---|---|---:|---:|---:|---:|---:|
| typed | all | 109 | 34/11 | 21/15 | 41/117 | 22 |
| typed | contextCases | 29 | 4/6 | 2/7 | 23/77 | 10 |
| typed | contextMutants | 12 | 2/5 | 0/5 | 10/30 | 10 |
| typed | equipment | 1 | 3/0 | 0/2 | 7/8 | 1 |
| typed | oldWithoutEquipment | 67 | 25/0 | 19/1 | 1/2 | 1 |
| dataflow | all | 109 | 38/7 | 24/12 | 33/111 | 17 |
| dataflow | contextCases | 29 | 7/3 | 3/6 | 18/74 | 8 |
| dataflow | contextMutants | 12 | 3/4 | 2/3 | 8/28 | 7 |
| dataflow | equipment | 1 | 3/0 | 0/2 | 7/8 | 1 |
| dataflow | oldWithoutEquipment | 67 | 25/0 | 19/1 | 0/1 | 1 |
| null | all | 109 | 0/45 | 0/36 | 0/0 | 62 |
| null | contextCases | 29 | 0/10 | 0/9 | 0/0 | 14 |
| null | contextMutants | 12 | 0/7 | 0/5 | 0/0 | 12 |
| null | equipment | 1 | 0/3 | 0/2 | 0/0 | 1 |
| null | oldWithoutEquipment | 67 | 0/25 | 0/20 | 0/0 | 35 |
