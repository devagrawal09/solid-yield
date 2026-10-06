import base from "../../../packages/yield/vite.config.mjs";
import { resolve } from "node:path";
export default {
  ...base,
  resolve: {
    ...base.resolve,
    alias: [...base.resolve.alias,
      { find: /^solid-js\/refresh$/, replacement: resolve("packages/yield/node_modules/solid-js/dist/refresh.dev.js") },
      { find: /^solid-js$/, replacement: resolve("packages/yield/node_modules/solid-js/dist/solid.dev.js") },
      { find: /^@solidjs\/web$/, replacement: resolve("packages/yield/node_modules/@solidjs/web/dist/web.dev.js") }
    ]
  },
  define: { ...base.define, __DEV__: process.env.PROOF_PRODUCTION ? "false" : "true" },
  test: {
    ...base.test,
    include: ["documentation/calculus-proofs/probes/runtime.spec.tsx"],
    maxWorkers: 1
  }
};
