export default {
  test: {
    environment: "node",
    globals: true,
    include: ["examples/harness/native-todos/parity.test.mjs"],
    testTimeout: 120000
  }
};
