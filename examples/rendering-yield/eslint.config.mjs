import yieldConfig from "../harness/eslint.config.mjs";

// The routine code is the shared app; the variants' entries are the original's.
export default yieldConfig([], ["shared/src/**/*.{ts,tsx}"]);
