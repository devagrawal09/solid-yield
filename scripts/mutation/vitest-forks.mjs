// Stryker 10 hardcodes threads. macOS fsevents aborts during thread cleanup
// when the unchanged Vite tests create dev servers. Use process workers while
// retaining Stryker's setup, test selection and coverage transport.
import { vitestWrapper } from "./tools/node_modules/@stryker-mutator/vitest-runner/dist/src/vitest-wrapper.js";
const createVitest = vitestWrapper.createVitest;
vitestWrapper.createVitest = (mode, options) => createVitest(mode, { ...options, pool: "forks" });
export {
  strykerPlugins,
  strykerValidationSchema
} from "./tools/node_modules/@stryker-mutator/vitest-runner/dist/src/index.js";
