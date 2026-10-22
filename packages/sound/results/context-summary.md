# Context/services baseline summary

Counts are expectation entries (not individual diagnostics); extras count diagnostics.
A grouped entry can require several diagnostics, e.g. eight FailureControls handlers.
Warning misses also count as soundness failures. Analysis is unchanged; only emitter severity-table wiring changed.

| prototype | group | fixtures | errors hit/miss | warnings hit/miss | extra errors/warnings | failing fixtures |
|---|---|---:|---:|---:|---:|---:|
| typed | all | 109 | 48/22 | 7/4 | 68/90 | 22 |
| typed | contextCases | 29 | 4/12 | 2/1 | 39/61 | 10 |
| typed | contextMutants | 12 | 2/9 | 0/1 | 18/22 | 10 |
| typed | equipment | 1 | 3/0 | 0/2 | 8/7 | 1 |
| typed | oldWithoutEquipment | 67 | 39/1 | 5/0 | 3/0 | 1 |
| dataflow | all | 109 | 57/13 | 5/6 | 53/91 | 17 |
| dataflow | contextCases | 29 | 10/6 | 0/3 | 31/61 | 8 |
| dataflow | contextMutants | 12 | 5/6 | 0/1 | 13/23 | 7 |
| dataflow | equipment | 1 | 3/0 | 0/2 | 8/7 | 1 |
| dataflow | oldWithoutEquipment | 67 | 39/1 | 5/0 | 1/0 | 1 |
| null | all | 109 | 0/70 | 0/11 | 0/0 | 62 |
| null | contextCases | 29 | 0/16 | 0/3 | 0/0 | 14 |
| null | contextMutants | 12 | 0/11 | 0/1 | 0/0 | 12 |
| null | equipment | 1 | 0/3 | 0/2 | 0/0 | 1 |
| null | oldWithoutEquipment | 67 | 0/40 | 0/5 | 0/0 | 35 |
