# lowercase-jsx-helper

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/lowercase-jsx-helper`

Input: A module-level lowercase helper returning JSX or null, called as a function in a hole (`{formatMessage(n)}`).

Expected: Lowers or stays plain (sugar-design.md 'Wrappers, nested components...' says 'A lowercase render helper called as a function is unaffected').

Actual: `Helper.tsx:1:1 [SUGAR_COMPONENT] A sugar component needs a top-level PascalCase name.` App: BattleReportView `formatExplosiveMessage`, questions.tsx `formatCiv`/`formatCosts`.
