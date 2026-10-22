# OpenClaw precision controls (D-133)

30 frozen rc.17 reductions: **15 negatives and 15 paired positive mutants**.
A negative expects no error; that is a requirement, not a claim that B/C already
pass it. Every current extra error and warning is pinned, not filtered. The full
per-fixture comparison is in results/openclaw-precision-baseline.md.

| Pair (op- prefix) | Evidence | Positive change |
|---|---|---|
| loading-url | E02 | add an actual throwing onClick |
| loading-reactive-key | E02 | move a pending read outside Loading |
| focus-repair | E36; E38 companion | call an injected predicate inside the queued task |
| machine-class | E05/E08 | make start read a real async memo in effect apply |
| machine-members | E11/E13/E15/E17/E19/E21/E23/E25/E27/E29/E31/E33/E35/E37/E39/E41 | make get read a real async memo |
| held-callback | E24/E28/E30 safe-body control | supplied callback throws |
| held-ref | E34 safe-body control; S01 | supplied ref callback throws |
| native-listener | E18 unsure; review recommendation | use an injected method lookalike |
| set-add | E04 unsure; review recommendation | allow an injected add method |
| dependency-machine | 15 menu dist findings | remove the application's catch |
| dependency-string | E35 | remove the application's catch |
| e24-remove | E24 | replace safe callback with an injected declaration |
| e28-keydown | E28 | same, through keydown/removeAt |
| e30-select | E30 | same, through select/commit |
| e40-reselect | E40 | same, through optional onReselect |

Each origin has the upstream file/line and finding IDs in ../origins.mjs.
The last four positives retain a no-op default through the real rc.17 merge;
a present injected override still has unknown failure information (D-129).
They encode the binding user decision, not the first review's FP verdict.

The machine reductions use effect apply, a frozen nontracking phase, to isolate
the false pending classification from the original onSettled ownership question.
This does not freeze onSettled lifetime rules. The focus reduction catches the
earlier remove/destinations calls before scheduling; their unknown failures must
not leak into the microtask. Its mutant adds a different unknown call *inside*
the task. Known safe forwarding and native receiver controls must not justify a
name-only exemption for unknown callbacks or lookalike methods.

## Installed-package boundary

node_modules/@precision/machine is a local, fake, parse-only installed package.
The app imports its declarations. Its dist implementation is never executed.
The dependency-machine fixtures also pass an unrendered installed TSX component
as an extra checked root. This deliberately over-inclusive input proves that
installed code cannot become an authored diagnostic location, even when entry
resolution already selects declarations. That component has imperative machine
reads (reproducing C's false pending cascade) and an unknown callback contract;
none belong in an application report. The paired app call without catch still
requires UNHANDLED_HANDLER_FAILURE at the app's onClick. Current violations
inside the installed probe remain visible in the exact baseline.

Runtime evidence: ../../results/openclaw-precision-runtime.md.
No copied application source, script or package implementation is executed.
