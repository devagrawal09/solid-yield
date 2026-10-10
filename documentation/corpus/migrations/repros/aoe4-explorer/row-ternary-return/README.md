# row-ternary-return

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/row-ternary-return`

Input: A `<For>` row returning a JSX ternary (`cond ? <b/> : <i/>`), block body or expression body. `ComponentTernaryControl.tsx` returns the same ternary from a component and passes.

Expected: Lowers; both branches are JSX.

Actual: `BlockRowTernary.tsx:7:9 [SUGAR_RETURN] Return JSX on every component or row path.` and `ExprRowTernary.tsx:1:1` (expression body: position lost; the Vite-side message prints `undefined:undefined`). App sites: 8 `v?.length ? <div/> : <></>` rows, Cards civ-flag row, StatCosts `cond && <div/>` row, civ page `unit.unique && <a/>` rows.
