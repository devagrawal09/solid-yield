# function-prop-args

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/function-prop-args`

Input: A render-function prop called with arguments in the view: `{props.valueFunc(props.left)}`.

Expected: Accepted.

Actual: `StatLine.tsx:3:17 [generated] [SUGAR_CALLBACK]`; moving the call into a local helper gives `[SUGAR_READ_ARGS] A source read takes no arguments.` (BattleReportView `StatLine`, still refused in the app).
