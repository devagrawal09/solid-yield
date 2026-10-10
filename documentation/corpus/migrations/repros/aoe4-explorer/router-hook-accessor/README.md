# router-hook-accessor

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/router-hook-accessor`

Input: `useMatch(() => props.href)` (the router's documented accessor form); `MemoControl.tsx` passes a `createMemo` instead.

Expected: One of the two is accepted: they are the only ways to call @solidjs/router 2 accessor hooks (useMatch, useLinkState, useHref, useResolvedPath).

Actual: `MenuLink.tsx:5:34 [SUGAR_CALLBACK]` (refused) and `MemoControl.tsx:6:28 TS2345 Argument of type 'Source<string, never, false>' is not assignable to parameter of type '() => string | TypedPath<Params>'` + `[GENERATED_TYPE]` + `[NATIVE_SETUP_FAILURE]`. The app dropped useMatch/useLinkState and styles anchors with the router's own `aria-current` / `data-active`.
