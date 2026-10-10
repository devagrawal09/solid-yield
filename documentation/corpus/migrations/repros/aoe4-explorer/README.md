# aoe4-explorer repros for solid-yield native mode (verifier proto/sugar-types @ 31695cb)

Each directory holds one native `.tsx` file and a `tsconfig.json` that resolves Solid from the migrated app's
`node_modules` (`/home/user/migrations/aoe4-explorer`). Run from that app directory (Node 24 on PATH):

    cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/<dir>

Each `<dir>/README.md` gives the expected and actual result. All inputs are valid Solid 2 (they build and run with
`@solidjs/vite-plugin` alone) unless the README says otherwise.
