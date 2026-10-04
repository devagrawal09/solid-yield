import blocksConfig from "../harness/eslint.config.mjs";

// The block code is the shared app; the variants' entries are the original's.
export default blocksConfig([], ["shared/src/**/*.{ts,tsx}"]);
