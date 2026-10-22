# OpenClaw precision baseline (D-133)

Unchanged B=dataflow, C=oxc, and null. 30 fixtures: 15 negative controls and 15
paired mutants, including E24/E28/E30/E40 as true D-129 obligations. No prototype
analysis was edited. Precision is measured by **extras per fixture**, especially
errors on negative controls, not merely successful expected hits.

| Prototype | Hits | Misses | Extra errors | Extra warnings | Errors on negatives | Errors inside dependency |
|---|---:|---:|---:|---:|---:|---:|
| dataflow | 13 | 2 | 7 | 8 | 6 | 2 |
| oxc | 13 | 2 | 22 | 24 | 14 | 8 |
| null | 0 | 15 | 0 | 0 | 0 | 0 |

## dataflow: every fixture

| Fixture | Hit | Miss | Extra errors | Extra warnings |
|---|---:|---:|---:|---:|
| op-loading-url | 0 | 0 | 0 | 0 |
| op-loading-url-mutant | 1 | 0 | 0 | 0 |
| op-loading-reactive-key | 0 | 0 | 0 | 0 |
| op-loading-reactive-key-mutant | 0 | 1 | 0 | 0 |
| op-focus-repair | 0 | 0 | 0 | 0 |
| op-focus-repair-mutant | 1 | 0 | 0 | 0 |
| op-machine-class | 0 | 0 | 0 | 0 |
| op-machine-class-mutant | 0 | 1 | 0 | 0 |
| op-machine-members | 0 | 0 | 0 | 0 |
| op-machine-members-mutant | 1 | 0 | 0 | 0 |
| op-held-callback | 0 | 0 | 0 | 0 |
| op-held-callback-mutant | 1 | 0 | 0 | 0 |
| op-held-ref | 0 | 0 | 0 | 0 |
| op-held-ref-mutant | 1 | 0 | 0 | 0 |
| op-native-listener | 0 | 0 | 1 | 0 |
| op-native-listener-mutant | 1 | 0 | 0 | 0 |
| op-set-add | 0 | 0 | 0 | 0 |
| op-set-add-mutant | 1 | 0 | 0 | 0 |
| op-dependency-machine | 0 | 0 | 1 | 0 |
| op-dependency-machine-mutant | 1 | 0 | 1 | 0 |
| op-dependency-string | 0 | 0 | 0 | 0 |
| op-dependency-string-mutant | 1 | 0 | 0 | 0 |
| op-e24-remove | 0 | 0 | 1 | 1 |
| op-e24-remove-mutant | 1 | 0 | 0 | 1 |
| op-e28-keydown | 0 | 0 | 1 | 1 |
| op-e28-keydown-mutant | 1 | 0 | 0 | 1 |
| op-e30-select | 0 | 0 | 1 | 1 |
| op-e30-select-mutant | 1 | 0 | 0 | 1 |
| op-e40-reselect | 0 | 0 | 1 | 1 |
| op-e40-reselect-mutant | 1 | 0 | 0 | 1 |

## oxc: every fixture

| Fixture | Hit | Miss | Extra errors | Extra warnings |
|---|---:|---:|---:|---:|
| op-loading-url | 0 | 0 | 1 | 0 |
| op-loading-url-mutant | 1 | 0 | 1 | 0 |
| op-loading-reactive-key | 0 | 0 | 1 | 0 |
| op-loading-reactive-key-mutant | 0 | 1 | 1 | 0 |
| op-focus-repair | 0 | 0 | 1 | 0 |
| op-focus-repair-mutant | 1 | 0 | 0 | 0 |
| op-machine-class | 0 | 0 | 2 | 2 |
| op-machine-class-mutant | 0 | 1 | 2 | 2 |
| op-machine-members | 0 | 0 | 0 | 0 |
| op-machine-members-mutant | 1 | 0 | 0 | 0 |
| op-held-callback | 0 | 0 | 0 | 0 |
| op-held-callback-mutant | 1 | 0 | 0 | 0 |
| op-held-ref | 0 | 0 | 0 | 0 |
| op-held-ref-mutant | 1 | 0 | 0 | 0 |
| op-native-listener | 0 | 0 | 1 | 0 |
| op-native-listener-mutant | 1 | 0 | 0 | 0 |
| op-set-add | 0 | 0 | 0 | 0 |
| op-set-add-mutant | 1 | 0 | 0 | 0 |
| op-dependency-machine | 0 | 0 | 4 | 2 |
| op-dependency-machine-mutant | 1 | 0 | 4 | 2 |
| op-dependency-string | 0 | 0 | 0 | 0 |
| op-dependency-string-mutant | 1 | 0 | 0 | 0 |
| op-e24-remove | 0 | 0 | 1 | 2 |
| op-e24-remove-mutant | 1 | 0 | 0 | 2 |
| op-e28-keydown | 0 | 0 | 1 | 2 |
| op-e28-keydown-mutant | 1 | 0 | 0 | 2 |
| op-e30-select | 0 | 0 | 1 | 2 |
| op-e30-select-mutant | 1 | 0 | 0 | 2 |
| op-e40-reselect | 0 | 0 | 1 | 2 |
| op-e40-reselect-mutant | 1 | 0 | 0 | 2 |

## null: every fixture

| Fixture | Hit | Miss | Extra errors | Extra warnings |
|---|---:|---:|---:|---:|
| op-loading-url | 0 | 0 | 0 | 0 |
| op-loading-url-mutant | 0 | 1 | 0 | 0 |
| op-loading-reactive-key | 0 | 0 | 0 | 0 |
| op-loading-reactive-key-mutant | 0 | 1 | 0 | 0 |
| op-focus-repair | 0 | 0 | 0 | 0 |
| op-focus-repair-mutant | 0 | 1 | 0 | 0 |
| op-machine-class | 0 | 0 | 0 | 0 |
| op-machine-class-mutant | 0 | 1 | 0 | 0 |
| op-machine-members | 0 | 0 | 0 | 0 |
| op-machine-members-mutant | 0 | 1 | 0 | 0 |
| op-held-callback | 0 | 0 | 0 | 0 |
| op-held-callback-mutant | 0 | 1 | 0 | 0 |
| op-held-ref | 0 | 0 | 0 | 0 |
| op-held-ref-mutant | 0 | 1 | 0 | 0 |
| op-native-listener | 0 | 0 | 0 | 0 |
| op-native-listener-mutant | 0 | 1 | 0 | 0 |
| op-set-add | 0 | 0 | 0 | 0 |
| op-set-add-mutant | 0 | 1 | 0 | 0 |
| op-dependency-machine | 0 | 0 | 0 | 0 |
| op-dependency-machine-mutant | 0 | 1 | 0 | 0 |
| op-dependency-string | 0 | 0 | 0 | 0 |
| op-dependency-string-mutant | 0 | 1 | 0 | 0 |
| op-e24-remove | 0 | 0 | 0 | 0 |
| op-e24-remove-mutant | 0 | 1 | 0 | 0 |
| op-e28-keydown | 0 | 0 | 0 | 0 |
| op-e28-keydown-mutant | 0 | 1 | 0 | 0 |
| op-e30-select | 0 | 0 | 0 | 0 |
| op-e30-select-mutant | 0 | 1 | 0 | 0 |
| op-e40-reselect | 0 | 0 | 0 | 0 |
| op-e40-reselect-mutant | 0 | 1 | 0 | 0 |

## Exact known failures

openclaw-precision-known.json pins the whole score for each prototype and fixture,
including every extra error/warning and its original location/message. No findings
are filtered, and dependency-body errors remain visible failures of the new rule.
A crash aborts the refresh. Old groups keep their existing assertions/baselines.
Both regressions and improvements fail the suite until reviewed. Partial class and
dependency fixtures still count missed expectations in the table even where the
legacy scorer does not mark their whole fixture as an in-subset soundness failure.
Runtime evidence: openclaw-precision-runtime.md.
