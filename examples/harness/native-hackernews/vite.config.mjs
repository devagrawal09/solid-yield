export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-hackernews/parity.test.mjs"],
    testTimeout: 120000
  }
};
