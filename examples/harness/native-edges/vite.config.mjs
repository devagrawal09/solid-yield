export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-edges/parity.test.mjs"],
    testTimeout: 120000
  }
};
