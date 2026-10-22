# Deferred OpenClaw gaps

Not frozen by D-131. Numbers are draft/gap IDs in the read-only mining GAPS.md,
not its priority ranks. These drafts remain research, not shared expectations.

| Gap | Deferred rule |
|---|---|
| 11 | onSettled committed-phase reads, callback ownership and disposal |
| 13 | ownedWrite and source-adapter re-entrancy |
| 14 | merge / omit / spreads and preserved prop facts |
| 15 | children() retention and ownership |
| 16 | store proxy, setter and raw-object alias writes |
| 17 | seedless projections and retained draft stores |
| 18 | derived signal computes |
| 19 | actions, retirement and generator failures |
| 20 | optimistic guesses and connection/epoch lifetimes |
| 21 | latest / isPending probes versus outcome observation |
| 22 | Loading reset keys, retry/fallback ordering |
| 23 | ref ownership, cleanup and primitive creation (only read scopes frozen) |
| 24 | list identity, reuse and focus (not read tracking) |
| 25 | primitive/root creation in effects and interop ownership |
| 26 | reactive reads after await |
| 27 | loadingValue and rendered rejection facts |

Gaps 01–10 and 12 are frozen in fixtures/openclaw.mjs. Gap 02 is included
because rc.17 confirms that effect apply/helper reads are untracked; compute
inputs forwarded as plain values are safe. Gap 23 has new read-only-scope
reductions, not the mining cleanup/ownership drafts. No future draft was run.
