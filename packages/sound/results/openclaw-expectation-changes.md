# OpenClaw expectation changes

## Previously frozen suite

None. No existing fixture source or expectation is edited. D-131 only adds
row/ref read-scope requirements; native-for-indexed and ref-event-reads do not
contain a reactive read in those callback bodies requiring a changed expectation.
Prototypes are unchanged.

## Mining drafts → frozen reductions

- oc-12-keyed-row-snapshot-mutant: formerly clean under literal old prose; now
  STRICT_READ_UNTRACKED (error) at row().label, after runtime verification.
- oc-07-scoped-outcome / -mutant: split fulfilled async outcome from the memo
  that throws on its error field; move boundaries into a consuming child.
  Mutant failure primary is props.value with value={read()} related, not the
  original direct read() in App. No new failure on fulfilled transport itself.
- oc-02-effect-prop-phase / -mutant: forward compute input to an apply helper;
  mutant helper reads props.value in apply. Expected STRICT_READ_UNTRACKED and
  related caller expression retained; runtime confirmed the phase policy.
- Other selected draft expectations retain their code/severity/read anchors.
  Gap 09 promise-returning memo is rc.17-clean as written; selected reductions
  contain no createAsync. Legacy syntax is not copied into new programs.
- New translation, default-only, held-row, pending-row, index-mode and ref
  controls/mutants are added requirements, not changes to existing expectations.

All static proven findings are errors per D-130. No warning/error downgrade,
root-as-primary relaxation, suppression or any cast was used.

## ref-event-reads (post-merge correction, D-131)

The legacy ref-event-reads fixture predated D-131 and expected no read finding
inside its ref callback. D-131 (verified on rc.17: ref callbacks run once per
mount, untracked) requires STRICT_READ_UNTRACKED at the n() read in
`ref={el => { set(n() + el.childElementCount) }}`. Both prototypes B and C
independently reported this read and disputed the stale expectation with
runtime evidence (prototypes/dataflow/DISPUTES.md, prototypes/oxc/DISPUTES.md).
The expectation now requires the error; the deferred ref-ownership warning is
unchanged.
